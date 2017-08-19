const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('await-fs');
var crypto = require('crypto');

const args = process.argv.slice(2); // Keep only parameters args

const RETURN_CODES = {
  eligible: 0,
  badUsage: 1,
  notEligible: 2,
};

const OUTPUT_DIR = path.join(__dirname, 'output');
const usage = () => {
  console.log('npm start <address> [d:debug mode]');
  process.exit(RETURN_CODES.badUsage);
};

const address = args[0];
const debug = args[1] === 'd' || false ;

address !== undefined || usage();

// Various selectors definition
const addressFieldSel = '#TBX_SaisieAdresseAutocompletion';
const autoCompleteMenuSel = 'ul.ui-autocomplete';
const autoCompleteResultSel = `${autoCompleteMenuSel + ' li.ui-menu-item a.ui-corner-all:not(.o-link-arrow):first-child'}`
const testButtonSel = '#ctl00_ContentPlaceHolder1_TestAdresse_HL_Valide_AdresseAutoCompletion';
const resultSel = '#eligibility-result';
const eligibleSel = '[data-name="Eligible-Fibre"]';
const remainingStepDisplaySel = '#Titre_Chevron';
const currentStepSel = '.timeline-description .encours';

const addressHash = crypto.createHash('md5').update(address).digest('hex');

// Main
(async () => {
  const browser = await puppeteer.launch({headless: !debug});
  const page = await browser.newPage();
  const runOutputDir = path.join(OUTPUT_DIR, addressHash);
  console.log(`Output directory: ${runOutputDir}`);
  if (debug) {
    page.on('console', (...args) => {
      for (let i = 0; i < args.length; ++i)
        console.log(`[Remote console] ${i}: ${args[i]}`);
    });
  }

  // Create output directory
  try {
    await fs.stat(runOutputDir);
  } catch(e) {
    await fs.mkdir(runOutputDir);
  }

  await page.setViewport({width: 1024, height: 768});
  await page.goto('https://boutique.orange.fr/eligibilite', {waitUntil: 'networkidle'});

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
  let returnCode;
  const isEligible = await page.evaluate((eligibleSel) => {
    return document.querySelector(eligibleSel) !== null;
  }, eligibleSel);

  if (!isEligible) {
    returnCode = RETURN_CODES.notEligible;
    await page.click(remainingStepDisplaySel);
    console.log(await page.evaluate((currentStepSel) => {
      // Remove multiple line-break
      return document.querySelector(currentStepSel).innerText.trim().replace(/[\r\n]/g, '\n');
    }, currentStepSel));
  } else {
    returnCode = RETURN_CODES.eligible;
    console.log('Eligible !');
  }

  await page.screenshot({path: path.join(runOutputDir, 'result.png'), fullPage: true});
  browser.close();
  process.exit(returnCode);
})();