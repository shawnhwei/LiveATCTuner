if (typeof browser == "undefined") {
  globalThis.browser = chrome;
}

const popupRegex = /myHTML5Popup\('([A-Za-z0-9_]+)','([A-Za-z0-9_]+)'\)/;

browser.runtime.onMessage.addListener(async (request, sender, sendResponse) => {
  if (request.cmd === 'tune') {
    console.log('Looking for matches...');

    const matches = request.matches;
    const feeds = document.querySelectorAll('table > tbody > tr > td[bgcolor="lightblue"] > strong');
    let freqTable = null;

    outer: for (const feed of feeds) {
      for (const match of matches) {
        if (feed.innerText.includes(match)) {
          console.log(`Found match:`, feed.innerText);
          freqTable = feed.parentElement.parentElement.parentElement.parentElement;
          break outer;
        }
      }
    }

    if (freqTable == null) return;

    const link = freqTable.querySelector('a[onclick*="myHTML5Popup"]');
    const popup = link.attributes.onclick.textContent;
    const popupMatches = popup.match(popupRegex);
    const mount = popupMatches[1];
    const icao = popupMatches[2];

    console.log(`Attempting to open:`, mount, icao);

    await browser.runtime.sendMessage({
      cmd: 'listen',
      url: `https://www.liveatc.net/hlisten.php?mount=${mount}&icao=${icao}`
    });
  }
});