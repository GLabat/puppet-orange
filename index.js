const puppeteer = require('puppeteer');
const path = require('path');
var crypto = require('crypto');
const { promisify } = require('util');
const fs = require('fs');
const accessAsync = promisify(fs.access);
const mkdirAsync = promisify(fs.mkdir);

const args = process.argv.slice(2); // Keep only parameters args

const BAD_USAGE = 99;
const ELIGIBLE = 0;
const NOT_YET_ELIGIBLE = 1;
const NOT_ELIGIBLE = 2;

const ELIGIBILITY_STATES = [
  { code: ELIGIBLE, selector: '[data-name="Eligible-Fibre"]', },
  { code: NOT_YET_ELIGIBLE, selector: '#DIV_Etapes_Reponse', },
  { code: NOT_ELIGIBLE, selector: '[data-name="NonEligible-Fibre"]' },
];

// Main output directory
const OUTPUT_DIR = path.join(__dirname, 'output');

/**
 * Display the CLI options
 */
const usage = () => {
  console.log('npm start <address> [d:debug mode] [-s: silent nodejs]');
  process.exit(BAD_USAGE);
};

/**
 * Print debug information
 * @param {*} args 
 */
const debugLog = (...args) => {
  if (debug) {
    console.log(args);
  }
};

//================================================

const address = args[0];
const debug = args[1] === 'd' || false ;

address !== undefined || usage();

// Various selectors definition
const addressFieldSel = '#TBX_SaisieAdresseAutocompletion';
const autoCompleteMenuSel = 'ul.ui-autocomplete';
const autoCompleteResultSel = `${autoCompleteMenuSel + ' li.ui-menu-item a.ui-corner-all:not(.o-link-arrow):first-child'}`
const testButtonSel = '#ctl00_ContentPlaceHolder1_TestAdresse_HL_Valide_AdresseAutoCompletion';
const resultSel = '#eligibility-result';
const remainingStepDisplaySel = '#Titre_Chevron';
const currentStepSel = '.timeline-description .encours';

const addressHash = crypto.createHash('md5').update(address).digest('hex');

//=============== MAIN ===========================
(async () => {
  const browser = await puppeteer.launch({headless: !debug});
  const page = await browser.newPage();
  const runOutputDir = path.join(OUTPUT_DIR, addressHash);
  debugLog(`Output directory: ${runOutputDir}`);
  
  // Make sure main output directory exists
  try {
    await accessAsync(OUTPUT_DIR);
  } catch(e) {
    debugLog(`Creating main output directory: ${OUTPUT_DIR}`);
    await mkdirAsync(OUTPUT_DIR);
  }
  
  // Make sure output directory exists
  try {
    await accessAsync(runOutputDir);
  } catch(e) {
    debugLog(`Creating output directory: ${runOutputDir}`);
    await mkdirAsync(runOutputDir);
  }

  if (debug) {
    page.on('console', (...args) => {
      for (let i = 0; i < args.length; ++i)
        console.log(`[Remote console] ${i}: ${args[i]}`);
    });
  }

  await page.setViewport({width: 1024, height: 768});
  console.log('Checking…');
  await page.goto('https://boutique.orange.fr/eligibilite', {waitUntil: 'networkidle', networkIdleTimeout: 3000});

  // Enter the address
  await page.focus(addressFieldSel);
  await page.type(address, {delay: 100}); // Types slower, like a user
  // Select from autocomplete menu
  await page.waitForSelector(autoCompleteMenuSel, {visible: true});
  await page.click(autoCompleteResultSel, {visible: true});
  // Launch check by clicking on the Test button
  await page.click(testButtonSel);
  await page.waitForSelector(resultSel, {visible: true});

  // Result analysis
  const returnCode = await page.evaluate((eligibilityStates) => {
    // Iterate over states and check if available
    let stateCode;
    eligibilityStates.some((state) => {
      if (document.querySelector(state.selector) !== null) {
        stateCode = state.code;
      }
    });
    return stateCode;
  }, ELIGIBILITY_STATES);

  switch(returnCode) {
    case ELIGIBLE:
      console.log('### Eligible! ###');
      break;
      case NOT_ELIGIBLE:
      console.log('### Not eligible :-( ###');
      break;
      case NOT_YET_ELIGIBLE:
      console.log('### Not yet eligible! ###');
      await page.click(remainingStepDisplaySel);
      console.log(`### Progress: \n${await page.evaluate((currentStepSel) => {
        // Remove multiple line-breaks
        return document.querySelector(currentStepSel).innerText.replace(/^\s+|\s+$/g, '').replace(/[\r\n]/g, '\n');
      }, currentStepSel)}`);
      break;
    default:
      returnCode = BAD_USAGE;
      break;
  }

  await page.screenshot({path: path.join(runOutputDir, 'result.png'), fullPage: true});
  browser.close();
  process.exit(returnCode);
})();