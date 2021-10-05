const puppeteer = require('puppeteer');
const schedule = require('node-schedule');

require('dotenv').config()

const DATE_CHOICE = process.env.DATE_CHOICE;
const TIMESLOT_CHOICES = process.env.TIMESLOT_CHOICES.split(',');
const USERNAME = process.env.LOGIN_USERNAME;
const PASSWORD = process.env.LOGIN_PASSWORD;

const EXPANED_TIMESLOT_CHOICES = [];
for (const c of TIMESLOT_CHOICES) {
  EXPANED_TIMESLOT_CHOICES.push(...[`#td0_${c}`, `#td1_${c}`, `#td2_${c}`]);
}

async function login(page) {
  const frame = page.frames()[1]
  const usernameInput = await frame.waitForSelector('#txtUser');
  await usernameInput.type(USERNAME);

  const passwordInput = await frame.waitForSelector('#txtPwd');
  await passwordInput.type(PASSWORD);

  const loginBtn = await frame.waitForSelector('#btn_login');

  await loginBtn.click();

  await page.waitForResponse(response => response.ok())
}

async function goBookingPage(page) {
  const frame = page.frames()[1]
  await frame.waitForSelector('#lk_B1');

  const url = page.frames()[1].url().replace('KV_main.aspx', 'clubhouse/InternetBooking.aspx?member_no=101938968&proj_code=KV&club_phase_no=17&language=TC')

  await page.goto(url)

  await page.waitForNavigation()
  const badmintonBtn = await page.waitForSelector('#headercontrol_BA');
  await badmintonBtn.click();
}

async function main() {
  const browser = await puppeteer.launch({
    headless: false,
    userDataDir: './tmp_data',
    args: [
      '--autoplay-policy=user-gesture-required',
      '--disable-background-networking',
      '--disable-background-timer-throttling',
      '--disable-backgrounding-occluded-windows',
      '--disable-breakpad',
      '--disable-client-side-phishing-detection',
      '--disable-component-update',
      '--disable-default-apps',
      '--disable-dev-shm-usage',
      '--disable-domain-reliability',
      '--disable-extensions',
      '--disable-features=AudioServiceOutOfProcess',
      '--disable-hang-monitor',
      '--disable-ipc-flooding-protection',
      '--disable-notifications',
      '--disable-offer-store-unmasked-wallet-cards',
      '--disable-popup-blocking',
      '--disable-print-preview',
      '--disable-prompt-on-repost',
      '--disable-renderer-backgrounding',
      '--disable-setuid-sandbox',
      '--disable-speech-api',
      '--disable-sync',
      '--hide-scrollbars',
      '--ignore-gpu-blacklist',
      '--metrics-recording-only',
      '--mute-audio',
      '--no-default-browser-check',
      '--no-first-run',
      '--no-pings',
      '--no-sandbox',
      '--no-zygote',
      '--password-store=basic',
      '--use-mock-keychain',
    ]
  });
  const page = await browser.newPage()

  await page.setRequestInterception(true);
  page.on('request', (req) => {
    if (req.resourceType() === 'stylesheet' || req.resourceType() === 'font' || req.resourceType() === 'image' || req.url().includes('ClubNoticeList.aspx') || req.url().includes('meetingList.aspx') || req.url().includes('latestnews.aspx')) {
      req.abort();
    }
    else {
      req.continue();
    }
  });

  await page.goto('https://www.locwood.com.hk/')

  await page.setViewport({ width: 924, height: 799 })

  console.time('login');
  await login(page);
  console.timeEnd('login');

  console.time('goBookingPage');
  await goBookingPage(page);
  await page.waitForNavigation()
  console.timeEnd('goBookingPage');

  console.time('book');
  const dateSelect = await page.waitForSelector('#SelectedDate');
  await dateSelect.select(DATE_CHOICE);


  const timeslotElements = await Promise.all(EXPANED_TIMESLOT_CHOICES.map(c => page.waitForSelector(c)));
  const timeslotAvailablities = await Promise.all(timeslotElements.map(c => page.evaluate(el => el.getAttribute('bgcolor'), c)));
  console.log(timeslotAvailablities);

  const selectedIdx = timeslotAvailablities.findIndex(t => t === '#00ff00');
  if (selectedIdx > -1) {
    await timeslotElements[selectedIdx].click();
    const nextBtn = await page.waitForSelector('#button1');
    await nextBtn.click();

    const confirmBtn = await page.waitForSelector('#cmd_confirm');
    await confirmBtn.click();
    console.log(`Booked! ${DATE_CHOICE} ${EXPANED_TIMESLOT_CHOICES[selectedIdx]}`);
  }
  console.timeEnd('book');
  // await browser.close()
  
}

// main();

const date = new Date(process.env.EXEC_SCHEDULE);
console.log(date.toString());

schedule.scheduleJob(date, async () => await main());
