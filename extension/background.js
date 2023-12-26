import { default as Papa } from './papaparse.min.js';
import { default as haversine } from './haversine.js';

if (typeof browser == "undefined") {
  globalThis.browser = chrome;
}

const airportsCSV = browser.runtime.getURL('airports.csv');
const airportFreqsCSV = browser.runtime.getURL('airport-frequencies.csv');

let matches = [];
let airports = [];
let freqs = [];
let lastRadio = null;
let searchTab = null;
let listenTab = null;
let enabled = false;

function rightPad(input) {
  while (input.length < 7) {
    input += '0';
  }
  return input;
}

function rightTrim(input) {
  while (input.length > 3 && input.charAt(input.length - 1) === '0') {
    input = input.substring(0, input.length - 1);
  }
  return input;
}

async function updateTuner(start, radio) {
  console.log(`Searching for streams on freq ${radio} within 100nmi of:`, start);

  for (const airport of airports) {
    const end = {
      latitude: airport.latitude,
      longitude: airport.longitude
    };

    const dist = haversine(start, end, { unit: 'nmi' });
    if (dist > 100) continue;

    const mhz = rightTrim(radio);

    for (const freq of freqs) {
      if (freq.airport_ident === airport.ident && freq.frequency_mhz === mhz) {
        matches.push(airport.ident);
      }
    }
  }

  console.log(`Found the following airports within range:`, matches);

  searchTab = await browser.tabs.create({
    url: `https://www.liveatc.net/search/f.php?freq=${radio}`,
  });
}

async function closeTabs() {
  try {
    if (searchTab != null) {
      await browser.tabs.remove(searchTab.id);
    }
    if (listenTab != null) {
      await browser.tabs.remove(listenTab.id);
    }
  } catch (e) { }
}

fetch(airportsCSV)
  .then(response => response.blob())
  .then(blob => {
    Papa.parse(blob, {
      header: true,
      complete: function (results) {
        for (let item of results.data) {
          item.latitude = parseFloat(item.latitude_deg);
          item.longitude = parseFloat(item.longitude_deg);
        }

        airports = results.data;
      }
    });
  });

fetch(airportFreqsCSV)
  .then(response => response.blob())
  .then(blob => {
    Papa.parse(blob, {
      header: true,
      complete: function (results) {
        freqs = results.data;
      }
    });
  });

browser.action.onClicked.addListener(async () => {
  console.log(`Requesting permissions...`);
  const approved = await browser.permissions.request({
    "origins": [
      "https://www.liveatc.net/*"
    ]
  });
  console.log(approved ? `Permissions granted` : `Permissions not granted`);

  enabled = !enabled;
  console.log(enabled ? `Extension is now ENABLED` : `Extension is now DISABLED`);

  if (enabled) {
    browser.action.setIcon({ path: { "128": "radio.png" } });
    browser.alarms.create({ periodInMinutes: 0.05 });
  } else {
    browser.action.setIcon({ path: { "128": "radio-off.png" } });
    await browser.alarms.clearAll();
    await closeTabs();
  }
});

browser.alarms.onAlarm.addListener(async () => {
  if (!enabled) return;

  const response = await fetch("http://localhost:49888");
  const data = await response.json();

  const newRadio = `${data.mhz}.${data.khz}`;

  if (newRadio !== lastRadio) {
    console.log(`Radio changed to ${newRadio} from ${lastRadio}`);
    lastRadio = newRadio;
  } else {
    return;
  }

  await closeTabs();
  await updateTuner(
    {
      latitude: data.lat,
      longitude: data.lng
    },
    rightPad(newRadio)
  );
});

browser.runtime.onMessage.addListener(async (request, sender, sendResponse) => {
  if (request.cmd === 'listen') {
    listenTab = await browser.tabs.create({
      url: request.url,
    });
  }
});

browser.tabs.onUpdated.addListener(async (tabId, changeInfo, tabInfo) => {
  if (searchTab.id && tabId === searchTab.id && changeInfo.status === 'complete') {
    console.log('Search tab ready');
    await browser.tabs.sendMessage(tabId, { cmd: "tune", matches });
  }
});