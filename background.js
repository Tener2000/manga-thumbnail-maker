// サイドパネルを開くためのbackground script

// 拡張機能アイコンがクリックされたときにサイドパネルを開く
chrome.action.onClicked.addListener((tab) => {
    chrome.sidePanel.open({ windowId: tab.windowId });
});
