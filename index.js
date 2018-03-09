const puppeteer = require('puppeteer')
const path = require('path')
const crypto = require('crypto')
const { promisify } = require('util')
const fs = require('fs')
const chalk = require('chalk')

// ## To remove?
const accessAsync = promisify(fs.access)
const mkdirAsync = promisify(fs.mkdir)

const args = require('yargs')
  .usage('node $0 [options]')
  .option('address', {
    alias: 'a',
    describe: 'the postal address to check eligibility for',
    require: true,
    type: 'string'
  })
  .option('debug', {
    alias: 'd',
    describe: 'debug mode with more logs',
    type: 'boolean',
    default: false
  })
  .option('outputDir', {
    alias: 'o',
    describe: 'path to directory to store script results',
    type: 'string',
    default: path.join(__dirname, 'output')
  })
  .help('h')
  .alias('h', 'help').argv

const address = args.address
const debug = args.debug
const OUTPUT_DIR = args.outputDir

const UNKNOWN_ERR = 99
const ELIGIBLE = 0
const NOT_YET_ELIGIBLE = 1
const NOT_ELIGIBLE = 2

const ELIGIBILITY_STATES = [
  { code: ELIGIBLE, selector: '[data-name="Eligible-Fibre"]' },
  { code: NOT_YET_ELIGIBLE, selector: '#DIV_Etapes_Reponse' },
  { code: NOT_ELIGIBLE, selector: '[data-name="NonEligible-Fibre"]' }
]

/**
 * Print debug information
 * @param {*} args
 */
const debugLog = (...args) => {
  if (debug) {
    console.log(chalk.cyan(`[Debug] ${args}`))
  }
}

const infoLog = (...args) => {
  console.log(chalk.green(`[Info] ${args}`))
}

const warnLog = (...args) => {
  console.log(chalk.yellow(`[Warn] ${args}`))
}

const errLog = (...args) => {
  console.log(chalk.red(`[Error] ${args}`))
}

const descLog = (...args) => {
  console.log(chalk.magenta(args))
}

const neutralLog = (...args) => {
  console.log(chalk.white(args))
}

//================================================

// Various selectors definition
const addressFieldSel = '#TBX_SaisieAdresseAutocompletion'
const autoCompleteMenuSel = 'ul.ui-autocomplete'
const autoCompleteResultSel = `${autoCompleteMenuSel +
  ' li.ui-menu-item a.ui-corner-all:not(.o-link-arrow):first-child'}`
const testButtonSel =
  '#ctl00_ContentPlaceHolder1_TestAdresse_HL_Valide_AdresseAutoCompletion'
const resultSel = '#eligibility-result'
const remainingStepDisplaySel = '#Titre_Chevron'
const currentStepSel = '.timeline-description .encours'

const showMapSel = '#Edito_Etape2A_AS_Non_Requis_Time_Line_EnCours a'

const addressHash = crypto
  .createHash('md5')
  .update(address)
  .digest('hex')

//=============== MAIN ===========================
puppeteer
  .launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] })
  .then(async browser => {
    const page = await browser.newPage()
    const runOutputDir = path.join(OUTPUT_DIR, addressHash)
    debugLog(`Output directory: ${runOutputDir}`)

    // Make sure main output directory exists
    try {
      await accessAsync(OUTPUT_DIR)
    } catch (e) {
      debugLog(`Creating main output directory: ${OUTPUT_DIR}`)
      await mkdirAsync(OUTPUT_DIR)
    }

    // Make sure output directory exists
    try {
      await accessAsync(runOutputDir)
    } catch (e) {
      debugLog(`Creating output directory: ${runOutputDir}`)
      await mkdirAsync(runOutputDir)
    }

    if (debug) {
      page.on('console', (...args) => {
        for (let i = 0; i < args.length; ++i)
          neutralLog(`[Remote console] ${i}: ${args[i]}`)
      })
    }

    await page.setViewport({ width: 1024, height: 768 })
    infoLog('Checking…')
    await page.goto('https://boutique.orange.fr/eligibilite')

    // Enter the address
    await page.focus(addressFieldSel)
    await page.type(addressFieldSel, address, { delay: 100 }) // Types slowly, like a user
    // Select from autocomplete menu
    await page.waitForSelector(autoCompleteMenuSel, { visible: true })
    await page.click(autoCompleteResultSel, { visible: true })
    // Launch check by clicking on the Test button
    await page.click(testButtonSel)
    await page.waitForSelector(resultSel, { visible: true })

    // Result analysis
    let returnCode = await page.evaluate(eligibilityStates => {
      // Iterate over states and check if available
      let stateCode
      eligibilityStates.some(state => {
        if (document.querySelector(state.selector) !== null) {
          stateCode = state.code
        }
      })
      return stateCode
    }, ELIGIBILITY_STATES)

    switch (returnCode) {
      case ELIGIBLE:
        warnLog('### Eligible! ###')
        break
      case NOT_ELIGIBLE:
        warnLog('### Not eligible :-( ###')
        break
      case NOT_YET_ELIGIBLE:
        warnLog('### Not yet eligible! ###')
        await page.click(remainingStepDisplaySel)
        descLog(
          `### Progress: \n${await page.evaluate(currentStepSel => {
            // Remove multiple line-breaks
            return document
              .querySelector(currentStepSel)
              .innerText.replace(/^\s+|\s+$/g, '')
              .replace(/[\r\n]/g, '\n')
          }, currentStepSel)}`
        )
        await page.click(showMapSel)
        await page.waitForSelector('#map.js-show')
        await page.screenshot({ path: 'map.png' })
        break
      default:
        returnCode = UNKNOWN_ERR
        break
    }

    await page.screenshot({
      path: path.join(runOutputDir, 'result.png'),
      fullPage: true
    })
    browser.close()
    process.exit(returnCode)
  })
  .catch(e => {
    errLog(e.message)
    process.exit(UNKNOWN_ERR)
  })
