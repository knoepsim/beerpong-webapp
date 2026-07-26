const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  // Navigate to login
  await page.goto('http://localhost:3000/login');
  
  // Fill phone
  await page.fill('input[type="tel"]', '1511234567');
  await page.click('button[type="submit"]');
  
  // Wait for OTP step
  await page.waitForSelector('.cn-input-otp');
  
  // Try to type OTP
  console.log('Typing OTP...');
  await page.type('.cn-input-otp input', '123456', { delay: 100 });
  
  const otpValue = await page.inputValue('.cn-input-otp input');
  console.log('OTP Value inside input:', otpValue);
  
  await browser.close();
})();
