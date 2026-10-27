// グローバル変数
const DEFAULT_CANVAS_WIDTH = 1280;
const DEFAULT_CANVAS_HEIGHT = 720;
const PADDING_PERCENT = 0.05; // 5%の余白(上下左右)
const TOTAL_PRESETS = 10;
const PRESETS_PER_PAGE = 4;
let presetPage = 0;

let selectedBackgroundIndex = null;
let selectedBackgroundImage = null;
let coverImage = null;
let coverImageFile = null; // 表紙画像のファイル情報を保存
let currentPosition = 'center'; // 'center' or 'left'

// 全巻特典用変数
let isZenkanMode = false;
let zenkanImages = [null, null, null]; // [img1, img2, img3]
let zenkanFiles = [null, null, null];

// 上下巻用変数
let isJogekanMode = false;
let jogekanImages = [null, null];
let jogekanFiles = [null, null];
// Canvas: 1280x1280
// Left: 840x1280
// Right: 420x630 (Gap 20px)
const ZENKAN_COORDS = [
  { x: 0, y: 0, w: 840, h: 1280 },    // ① 左大
  { x: 860, y: 0, w: 420, h: 630 },   // ② 右上
  { x: 860, y: 650, w: 420, h: 630 }  // ③ 右下
];



// DOM要素
const presetGrid = document.getElementById('presetGrid');
const modePresetGrid = document.getElementById('modePresetGrid');
const previousPresetPage = document.getElementById('previousPresetPage');
const nextPresetPage = document.getElementById('nextPresetPage');
const presetPageStatus = document.getElementById('presetPageStatus');
const slotNumberInput = document.getElementById('slotNumber');
const registerImageInput = document.getElementById('registerImageInput');
const registerBtn = document.getElementById('registerBtn');
const coverImageInput = document.getElementById('coverImageInput');
const uploadBtn = document.getElementById('uploadBtn');
const importAmazonBtn = document.getElementById('importAmazonBtn');
const importAmazonSeriesBtn = document.getElementById('importAmazonSeriesBtn');
const amazonSeriesStatus = document.getElementById('amazonSeriesStatus');
const amazonImportStatus = document.getElementById('amazonImportStatus');
const bookTitleInput = document.getElementById('bookTitleInput');
const previewCanvas = document.getElementById('previewCanvas');
const downloadBtn = document.getElementById('downloadBtn');
const ctx = previewCanvas.getContext('2d');

// 全巻用要素
const standardCoverSection = document.getElementById('standardCoverSection');
const zenkanCoverSection = document.getElementById('zenkanCoverSection');
const zenkanInputs = [
  document.getElementById('zenkanInput1'),
  document.getElementById('zenkanInput2'),
  document.getElementById('zenkanInput3')
];

// 上下巻用要素
const jogekanCoverSection = document.getElementById('jogekanCoverSection');
const jogekanInputs = [
  document.getElementById('jogekanInput1'),
  document.getElementById('jogekanInput2')
];

// Amazonアフィリエイト用要素
const asinInput = document.getElementById('asinInput');
const affiliateIdInput = document.getElementById('affiliateIdInput');
const generateLinkBtn = document.getElementById('generateLinkBtn');
const generateManualLinkBtn = document.getElementById('generateManualLinkBtn');
const amazonLinkStatus = document.getElementById('amazonLinkStatus');
const generatedLinkOutput = document.getElementById('generatedLinkOutput');
const copyLinkBtn = document.getElementById('copyLinkBtn');

// 初期化
document.addEventListener('DOMContentLoaded', async () => {
  // 保存されているアフィリエイトIDを読み込む
  const result = await chrome.storage.local.get('affiliateId');
  if (result.affiliateId) {
    affiliateIdInput.value = result.affiliateId;
  }

  await loadPresets();
  setupEventListeners();
  drawInitialCanvas();
});

// イベントリスナー設定
function setupEventListeners() {
  previousPresetPage.addEventListener('click', () => changePresetPage(-1));
  nextPresetPage.addEventListener('click', () => changePresetPage(1));
  registerBtn.addEventListener('click', () => registerImageInput.click());
  registerImageInput.addEventListener('change', handleRegisterImage);

  importAmazonBtn.addEventListener('click', handleAmazonImport);
  importAmazonSeriesBtn.addEventListener('click', handleAmazonSeriesImport);

  uploadBtn.addEventListener('click', () => coverImageInput.click());
  coverImageInput.addEventListener('change', handleCoverImageUpload);

  // 配置切り替え
  document.querySelectorAll('input[name="coverPosition"]').forEach(radio => {
    radio.addEventListener('change', (e) => {
      currentPosition = e.target.value;
      updatePreview();
    });
  });

  // 全巻用イベントリスナー
  zenkanInputs.forEach((input, index) => {
    input.addEventListener('change', (e) => handleZenkanImageUpload(e, index));
  });

  // 上下巻用イベントリスナー
  jogekanInputs.forEach((input, index) => {
    input.addEventListener('change', (e) => handleJogekanImageUpload(e, index));
  });

  generateLinkBtn.addEventListener('click', handleGenerateLink);
  generateManualLinkBtn.addEventListener('click', () => handleGenerateLink(true));
  copyLinkBtn.addEventListener('click', handleCopyLink);

  downloadBtn.addEventListener('click', downloadImage);
}

// プリセット読み込み
async function loadPresets() {
  presetGrid.innerHTML = '';
  modePresetGrid.innerHTML = '';

  // Chrome Storageからユーザー登録画像を取得
  const result = await chrome.storage.local.get(['userBackgrounds', 'background7To1Migration']);
  const userBackgrounds = result.userBackgrounds || {};

  // 初回だけ7番を1番にも登録。元の1番は復元用に保持する。
  if (!result.background7To1Migration?.completed) {
    const previousBackground1 = userBackgrounds[1] || 'backgrounds/bg1.png';
    userBackgrounds[1] = userBackgrounds[7] || 'backgrounds/bg7.png';
    await chrome.storage.local.set({
      userBackgrounds,
      background7To1Migration: { completed: true, previousBackground1 }
    });
  }

  for (let i = 1; i <= TOTAL_PRESETS; i++) {
    const presetItem = document.createElement('div');
    presetItem.className = 'preset-item';
    presetItem.dataset.index = i;

    const numberLabel = document.createElement('div');
    numberLabel.className = 'preset-number';
    numberLabel.textContent = i;
    presetItem.appendChild(numberLabel);

    // 登録画像を優先し、未登録なら同梱背景を使用する。
    if (userBackgrounds[i] || i <= 7) {
      const img = document.createElement('img');
      img.src = userBackgrounds[i] || `backgrounds/bg${i}.png`;
      img.alt = `背景 ${i}`;
      presetItem.appendChild(img);
    } else {
      presetItem.classList.add('preset-empty');
      presetItem.textContent = '';
      const emptyText = document.createElement('span');
      emptyText.textContent = '未登録';
      emptyText.style.position = 'absolute';
      emptyText.style.top = '50%';
      emptyText.style.left = '50%';
      emptyText.style.transform = 'translate(-50%, -50%)';
      presetItem.appendChild(emptyText);
    }

    if (selectedBackgroundIndex === i) presetItem.classList.add('selected');
    presetItem.addEventListener('click', () => selectBackground(i, presetItem));
    presetGrid.appendChild(presetItem);
  }

  // 全巻特典用プリセット追加
  const zenkanPreset = document.createElement('div');
  zenkanPreset.className = 'preset-item';
  zenkanPreset.dataset.mode = 'zenkan';

  const zenkanLabel = document.createElement('div');
  zenkanLabel.className = 'preset-number';
  zenkanLabel.textContent = '全巻';
  zenkanPreset.appendChild(zenkanLabel);

  const zenkanImg = document.createElement('img');
  zenkanImg.src = 'backgrounds/zenkan.png';
  zenkanImg.alt = '全巻特典レイアウト';
  zenkanImg.onerror = () => { zenkanImg.src = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxNiA5IiBmaWxsPSIjNDQ0Ij48cmVjdCB3aWR0aD0iMTYiIGhlaWdodD0iOSIvPjx0ZXh0IHg9IjUiIHk9IjUiIGZpbGw9IiNmZmYiIGZvbnQtc2l6ZT0iMSI+WmVua2FuPC90ZXh0Pjwvc3ZnPg=='; }; // Fallback
  zenkanPreset.appendChild(zenkanImg);

  zenkanPreset.addEventListener('click', () => selectZenkanMode(zenkanPreset));
  if (isZenkanMode) zenkanPreset.classList.add('selected');
  modePresetGrid.appendChild(zenkanPreset);

  // 上下巻用プリセット追加
  const jogekanPreset = document.createElement('div');
  jogekanPreset.className = 'preset-item';
  jogekanPreset.dataset.mode = 'jogekan';

  const jogekanLabel = document.createElement('div');
  jogekanLabel.className = 'preset-number';
  jogekanLabel.textContent = '上下';
  jogekanPreset.appendChild(jogekanLabel);

  const jogekanImg = document.createElement('img');
  jogekanImg.src = 'backgrounds/jogekan.png'; // 専用アイコン
  jogekanImg.alt = '上下巻特典レイアウト';
  jogekanImg.onerror = () => { jogekanImg.src = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxNiA5IiBmaWxsPSIjNDQ0Ij48cmVjdCB3aWR0aD0iMTYiIGhlaWdodD0iOSIvPjx0ZXh0IHg9IjUiIHk9IjUiIGZpbGw9IiNmZmYiIGZvbnQtc2l6ZT0iMSI+Sm9nZWthbjwvdGV4dD48L3N2Zz4='; };
  jogekanPreset.appendChild(jogekanImg);

  jogekanPreset.addEventListener('click', () => selectJogekanMode(jogekanPreset));
  if (isJogekanMode) jogekanPreset.classList.add('selected');
  modePresetGrid.appendChild(jogekanPreset);
  changePresetPage(0);
}

function changePresetPage(direction) {
  const lastPage = Math.ceil(TOTAL_PRESETS / PRESETS_PER_PAGE) - 1;
  presetPage = Math.max(0, Math.min(lastPage, presetPage + direction));
  const start = presetPage * PRESETS_PER_PAGE;
  presetGrid.querySelectorAll('.preset-item').forEach((item, index) => {
    item.hidden = index < start || index >= start + PRESETS_PER_PAGE;
  });
  previousPresetPage.disabled = presetPage === 0;
  nextPresetPage.disabled = presetPage === lastPage;
  presetPageStatus.textContent = `${start + 1}〜${Math.min(start + PRESETS_PER_PAGE, TOTAL_PRESETS)} / ${TOTAL_PRESETS}枚`;
}

// 背景選択
function selectBackground(index, element) {
  // モードリセット
  isZenkanMode = false;
  isJogekanMode = false;
  toggleInputSection(false, false);

  // 既存の選択を解除
  document.querySelectorAll('.preset-item').forEach(item => {
    item.classList.remove('selected');
  });

  element.classList.add('selected');
  selectedBackgroundIndex = index;

  // 画像を読み込み
  const img = element.querySelector('img');
  if (img) {
    selectedBackgroundImage = new Image();
    selectedBackgroundImage.src = img.src;
    selectedBackgroundImage.onload = () => {
      updatePreview();
    };
  }
}

// 全巻モード選択
function selectZenkanMode(element) {
  isZenkanMode = true;
  isJogekanMode = false;
  toggleInputSection(true, false);

  // 既存の選択を解除
  document.querySelectorAll('.preset-item').forEach(item => {
    item.classList.remove('selected');
  });

  element.classList.add('selected');
  selectedBackgroundIndex = 'zenkan';

  // 背景画像読み込み
  const img = element.querySelector('img');
  selectedBackgroundImage = new Image();
  selectedBackgroundImage.src = img.src;
  selectedBackgroundImage.onload = () => updatePreview();
  selectedBackgroundImage.onerror = () => updatePreview(); // 画像がなくても続行
}

// 上下巻モード選択
function selectJogekanMode(element) {
  isZenkanMode = false;
  isJogekanMode = true;
  toggleInputSection(false, true);

  // 既存の選択を解除
  document.querySelectorAll('.preset-item').forEach(item => {
    item.classList.remove('selected');
  });

  element.classList.add('selected');
  selectedBackgroundIndex = 'jogekan';

  // 背景画像読み込み
  const img = element.querySelector('img');
  selectedBackgroundImage = new Image();
  selectedBackgroundImage.src = img.src;
  selectedBackgroundImage.onload = () => updatePreview();
  selectedBackgroundImage.onerror = () => updatePreview(); // 画像がなくても続行
}

function toggleInputSection(isZenkan, isJogekan) {
  standardCoverSection.style.display = (!isZenkan && !isJogekan) ? 'block' : 'none';
  zenkanCoverSection.style.display = isZenkan ? 'block' : 'none';
  jogekanCoverSection.style.display = isJogekan ? 'block' : 'none';
}

// ユーザー画像登録
async function handleRegisterImage(event) {
  const file = event.target.files[0];
  if (!file) return;

  const slotNumber = parseInt(slotNumberInput.value);
  if (slotNumber < 1 || slotNumber > 10) {
    alert('登録番号は1-10の範囲で指定してください');
    return;
  }

  const reader = new FileReader();
  reader.onload = async (e) => {
    const imageData = e.target.result;

    // Chrome Storageに保存
    const result = await chrome.storage.local.get('userBackgrounds');
    const userBackgrounds = result.userBackgrounds || {};
    userBackgrounds[slotNumber] = imageData;

    await chrome.storage.local.set({ userBackgrounds });

    // 登録先のページを表示してプリセットを再読み込み
    presetPage = Math.floor((slotNumber - 1) / PRESETS_PER_PAGE);
    await loadPresets();

    alert(`背景画像を番号 ${slotNumber} に登録しました`);
  };

  reader.readAsDataURL(file);
}

// 表紙画像アップロード
function handleCoverImageUpload(event) {
  const file = event.target.files[0];
  if (!file) return;

  // ファイル情報を保存
  coverImageFile = file;
  bookTitleInput.value = file.name.replace(/\.[^/.]+$/, '');

  const reader = new FileReader();
  reader.onload = (e) => {
    coverImage = new Image();
    coverImage.src = e.target.result;
    coverImage.onload = () => {
      updatePreview();
    };
  };

  reader.readAsDataURL(file);
}

// 全巻用画像アップロード
function handleZenkanImageUpload(event, index) {
  const file = event.target.files[0];
  if (!file) return;

  zenkanFiles[index] = file;

  const reader = new FileReader();
  reader.onload = (e) => {
    const img = new Image();
    img.src = e.target.result;
    img.onload = () => {
      zenkanImages[index] = img;
      updatePreview();
    };
  };
  reader.readAsDataURL(file);
}
// 上下巻用画像アップロード
function handleJogekanImageUpload(event, index) {
  const file = event.target.files[0];
  if (!file) return;

  jogekanFiles[index] = file;

  const reader = new FileReader();
  reader.onload = (e) => {
    const img = new Image();
    img.src = e.target.result;
    img.onload = () => {
      jogekanImages[index] = img;
      updatePreview();
    };
  };
  reader.readAsDataURL(file);
}

// プレビュー更新
function updatePreview() {
  // 背景画像のサイズに合わせてキャンバスサイズを調整
  let canvasWidth = DEFAULT_CANVAS_WIDTH;
  let canvasHeight = DEFAULT_CANVAS_HEIGHT;

  if (isZenkanMode) {
    // 全巻モードは1280x1280固定
    canvasWidth = 1280;
    canvasHeight = 1280;
  } else if (isJogekanMode) {
    // 上下巻モードは1200x900固定
    canvasWidth = 1200;
    canvasHeight = 900;
  } else if (selectedBackgroundImage) {
    // 背景画像の元のサイズを使用
    canvasWidth = selectedBackgroundImage.width;
    canvasHeight = selectedBackgroundImage.height;
  }

  // キャンバスサイズを設定
  previewCanvas.width = canvasWidth;
  previewCanvas.height = canvasHeight;

  // キャンバスをクリア
  ctx.clearRect(0, 0, canvasWidth, canvasHeight);

  if (isZenkanMode) {
    // 全巻モードは背景白
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);
    drawZenkanComposition();
  } else if (isJogekanMode) {
    // 上下巻モードは背景白
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);
    drawJogekanComposition();
  } else {
    // 背景画像を描画
    if (selectedBackgroundImage && selectedBackgroundImage.complete && selectedBackgroundImage.naturalWidth > 0) {
      ctx.drawImage(selectedBackgroundImage, 0, 0, canvasWidth, canvasHeight);
    } else {
      // デフォルト背景(グレー)
      ctx.fillStyle = '#2d2d44';
      ctx.fillRect(0, 0, canvasWidth, canvasHeight);
    }

    // 表紙画像を描画
    if (coverImage) {
      drawCoverWithShadow(canvasWidth, canvasHeight);
    }
  }
}

// 全巻合成描画
function drawZenkanComposition() {
  // 各画像のアスペクト比 (width / height) を取得。未アップロード時はデフォルト枠で代用
  const a1 = zenkanImages[0] ? (zenkanImages[0].width / zenkanImages[0].height) : (840 / 1280);
  const a2 = zenkanImages[1] ? (zenkanImages[1].width / zenkanImages[1].height) : (420 / 630);
  const a3 = zenkanImages[2] ? (zenkanImages[2].width / zenkanImages[2].height) : (420 / 630);

  const gap = 20;

  // 1巻（左）の天地に合わせて、右側の2巻・3巻のサイズを算出する
  // 高さの基準を1280 (キャンバス最大枠) とする
  let h1 = 1280;
  // 右側の幅W_rightとすると、2巻と3巻の高さはそれぞれ W_right/a2, W_right/a3
  // 高さを揃える: h2 + gap + h3 = h1
  // W_right/a2 + gap + W_right/a3 = h1
  // W_right * (1/a2 + 1/a3) = h1 - gap
  let wRight = (h1 - gap) / (1 / a2 + 1 / a3);
  let w1 = h1 * a1;
  let wTotal = w1 + gap + wRight;

  // 全体が1280幅をオーバーする場合は全体を縮小
  if (wTotal > 1280) {
    const scale = 1280 / wTotal;
    h1 *= scale;
    wRight *= scale;
    w1 *= scale;
    wTotal = 1280;
  }

  // キャンバス中央にセンタリング
  const xStart = (1280 - wTotal) / 2;
  const yStart = (1280 - h1) / 2;

  const h2 = wRight / a2;
  const h3 = wRight / a3;

  const dynamicCoords = [
    { x: xStart, y: yStart, w: w1, h: h1 }, // ① 1巻 (左)
    { x: xStart + w1 + gap, y: yStart, w: wRight, h: h2 }, // ② 2巻 (右上)
    { x: xStart + w1 + gap, y: yStart + h2 + gap, w: wRight, h: h3 } // ③ 3巻 (右下)
  ];

  dynamicCoords.forEach((coord, i) => {
    const img = zenkanImages[i];
    if (img) {
      // 算出された枠は画像のアスペクト比と完全一致するため、そのまま描画可能
      ctx.drawImage(img, coord.x, coord.y, coord.w, coord.h);
    } else {
      // 未選択時のプレースホルダー
      ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
      ctx.fillRect(coord.x, coord.y, coord.w, coord.h);

      ctx.fillStyle = '#666';
      ctx.font = 'bold 80px "Segoe UI"';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(i + 1, coord.x + coord.w / 2, coord.y + coord.h / 2);
    }
  });
}

// 上下巻合成描画
function drawJogekanComposition() {
  const gap = 20;

  // キャンバスサイズは 1200 x 900 に設定されている
  // 左右に2分割、中心に20pxの隙間
  const totalW = 1200;
  const h = 900;
  const w = (totalW - gap) / 2; // (1200 - 20) / 2 = 590

  const dynamicCoords = [
    { x: 0, y: 0, w: w, h: h }, // ① 上巻 (左)
    { x: w + gap, y: 0, w: w, h: h } // ② 下巻 (右)
  ];

  dynamicCoords.forEach((coord, i) => {
    const img = jogekanImages[i];
    if (img) {
      // 枠全体は白または透明（背景が白）なので、画像のcontain配置を計算する
      const imgAspect = img.width / img.height;
      const areaAspect = coord.w / coord.h; // これは 600/800 になる

      let drawW, drawH, drawX, drawY;

      if (imgAspect > areaAspect) {
        // 画像の方が横長 -> 幅を合わせる (contain)
        drawW = coord.w;
        drawH = coord.w / imgAspect;
        drawX = coord.x;
        drawY = coord.y + (coord.h - drawH) / 2;
      } else {
        // 画像の方が縦長 -> 高さを合わせる (contain)
        drawH = coord.h;
        drawW = coord.h * imgAspect;
        drawX = coord.x + (coord.w - drawW) / 2;
        drawY = coord.y;
      }

      ctx.save();
      // 画像がはみ出さないようにクリップ（containなので不要ですが念のため）
      ctx.beginPath();
      ctx.rect(coord.x, coord.y, coord.w, coord.h);
      ctx.clip();
      ctx.drawImage(img, drawX, drawY, drawW, drawH);
      ctx.restore();
    } else {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
      ctx.fillRect(coord.x, coord.y, coord.w, coord.h);

      ctx.fillStyle = '#666';
      ctx.font = 'bold 80px "Segoe UI"';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(i + 1, coord.x + coord.w / 2, coord.y + coord.h / 2);
    }
  });
}

// 表紙画像をドロップシャドウ付きで描画
function drawCoverWithShadow(canvasWidth, canvasHeight) {
  // 余白を計算
  const paddingX = canvasWidth * PADDING_PERCENT;
  const paddingY = canvasHeight * PADDING_PERCENT;
  const availableWidth = canvasWidth - (paddingX * 2);
  const availableHeight = canvasHeight - (paddingY * 2);

  // アスペクト比を維持してリサイズ
  const coverAspect = coverImage.width / coverImage.height;
  const availableAspect = availableWidth / availableHeight;

  let drawWidth, drawHeight;

  if (coverAspect > availableAspect) {
    // 横長の画像
    drawWidth = availableWidth;
    drawHeight = availableWidth / coverAspect;
  } else {
    // 縦長の画像
    drawHeight = availableHeight;
    drawWidth = availableHeight * coverAspect;
  }

  // センター配置の座標を計算
  let x;
  if (currentPosition === 'left') {
    // 左から500pxの位置にセンター
    // 画像の幅の半分を引く
    x = 500 - (drawWidth / 2);
  } else {
    // 中央
    x = (canvasWidth - drawWidth) / 2;
  }

  const y = (canvasHeight - drawHeight) / 2;

  // ドロップシャドウを設定
  ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
  ctx.shadowBlur = 35;
  ctx.shadowOffsetX = 18;
  ctx.shadowOffsetY = 18;

  // 表紙画像を描画
  ctx.drawImage(coverImage, x, y, drawWidth, drawHeight);

  // シャドウをリセット
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;
}

// 初期キャンバス描画
function drawInitialCanvas() {
  previewCanvas.width = DEFAULT_CANVAS_WIDTH;
  previewCanvas.height = DEFAULT_CANVAS_HEIGHT;

  ctx.fillStyle = '#2d2d44';
  ctx.fillRect(0, 0, DEFAULT_CANVAS_WIDTH, DEFAULT_CANVAS_HEIGHT);

  ctx.fillStyle = '#ffffff';
  ctx.font = '24px "Segoe UI"';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('背景と表紙を選択してください', DEFAULT_CANVAS_WIDTH / 2, DEFAULT_CANVAS_HEIGHT / 2);
}

// PNG画像としてダウンロード
function downloadImage() {
  if (isZenkanMode || isJogekanMode) {
    const targetImages = isZenkanMode ? zenkanImages : jogekanImages;
    if (!targetImages.some(img => img !== null)) {
      alert('少なくとも1枚の画像をアップロードしてください');
      return;
    }
  } else if (!selectedBackgroundImage && !coverImage) {
    alert('背景画像または表紙画像を選択してください');
    return;
  }

  const files = isZenkanMode ? zenkanFiles : isJogekanMode ? jogekanFiles : [coverImageFile];
  const firstFile = files.find(Boolean);
  const title = bookTitleInput.value.trim() || (firstFile ? firstFile.name.replace(/\.[^/.]+$/, '') : '書名未設定');
  const filename = sanitizeBookTitle(title) + (isZenkanMode ? '全巻サムネ' : 'サムネイル');

  // CanvasからPNGデータを取得
  previewCanvas.toBlob((blob) => {
    if (!blob) {
      alert('画像の生成に失敗しました');
      return;
    }

    // File System Access APIを使用して保存先を指定
    const options = {
      suggestedName: `${filename}.png`,
      types: [{
        description: 'PNG Images',
        accept: { 'image/png': ['.png'] }
      }]
    };

    // ファイル保存ダイアログを表示
    window.showSaveFilePicker(options)
      .then(fileHandle => fileHandle.createWritable())
      .then(writable => {
        writable.write(blob);
        return writable.close();
      })
      .catch(err => {
        // キャンセルされた場合はエラーを表示しない
        if (err.name !== 'AbortError') {
          console.error('保存エラー:', err);
          // フォールバック: 通常のダウンロード
          const link = document.createElement('a');
          link.download = `${filename}.png`;
          link.href = URL.createObjectURL(blob);
          link.click();
          URL.revokeObjectURL(link.href);
        }
      });
  }, 'image/png');
}

function getTimestamp() {
  const now = new Date();
  return `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;
}

// 商品ページで選択されている商品のASINを読み取る。
function readAmazonAsin() {
  const pageUrl = new URL(location.href);
  const pathAsin = pageUrl.pathname.match(/\/(?:dp|gp\/product|gp\/aw\/d)\/([A-Z0-9]{10})(?:\/|$)/i)?.[1];
  const isProduct = pathAsin || document.querySelector('#productTitle, #ebooksProductTitle');
  if (!isProduct) throw new Error('Amazonの商品ページを開いてください。');
  const selectedAsin = document.querySelector('#ASIN, input[name="ASIN"], #asin')?.value?.trim();
  const asin = /^[A-Z0-9]{10}$/i.test(selectedAsin || '') ? selectedAsin : pathAsin;
  if (!asin) throw new Error('商品のASINを取得できませんでした。ページの読み込み後に再試行してください。');
  return asin.toUpperCase();
}

// 通常は開いている商品から取得し、手入力ボタンの場合だけ入力欄を使う。
async function handleGenerateLink(manual = false) {
  generateLinkBtn.disabled = true;
  generateManualLinkBtn.disabled = true;
  generatedLinkOutput.value = '';
  amazonLinkStatus.textContent = '';
  try {
    const affiliateId = affiliateIdInput.value.trim();
    if (!affiliateId) throw new Error('アフィリエイトタグを入力してください。');
    let asin;
    if (manual === true) {
      asin = asinInput.value.trim().toUpperCase();
    } else {
      asinInput.value = '';
      amazonLinkStatus.textContent = '開いている商品のASINを取得しています…';
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.url || !/^https:\/\/(www\.)?amazon\.co\.jp\//i.test(tab.url)) {
        throw new Error('Amazon.co.jpの商品ページで拡張機能アイコンを押してから再試行してください。');
      }
      const [result] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: readAmazonAsin });
      asin = result?.result;
    }
    if (!/^[A-Z0-9]{10}$/.test(asin || '')) throw new Error('ASINは半角英数字10文字で指定してください。');
    await chrome.storage.local.set({ affiliateId });
    asinInput.value = asin;
    generatedLinkOutput.value = `https://www.amazon.co.jp/dp/${asin}?tag=${encodeURIComponent(affiliateId)}`;
    try {
      await navigator.clipboard.writeText(generatedLinkOutput.value);
      amazonLinkStatus.textContent = `ASIN: ${asin} のリンクを作成し、コピーしました。`;
    } catch (_) {
      amazonLinkStatus.textContent = `ASIN: ${asin} のリンクを作成しました。自動コピーできなかったため、コピーボタンを押してください。`;
    }
  } catch (error) {
    amazonLinkStatus.textContent = `リンク作成失敗: ${error.message}`;
  } finally {
    generateLinkBtn.disabled = false;
    generateManualLinkBtn.disabled = false;
  }
}

// リンクをクリップボードにコピー
function handleCopyLink() {
  const url = generatedLinkOutput.value;
  if (!url) return;

  navigator.clipboard.writeText(url).then(() => {
    const originalText = copyLinkBtn.textContent;
    copyLinkBtn.textContent = '✅ コピー完了';
    setTimeout(() => {
      copyLinkBtn.textContent = originalText;
    }, 2000);
  }).catch(err => {
    console.error('クリップボードへのコピーに失敗しました:', err);
    alert('コピーに失敗しました');
  });
}

function sanitizeBookTitle(title) {
  return title.replace(/[<>:"/\\|?*\x00-\x1f]/g, '＿').replace(/[. ]+$/g, '').slice(0, 100) || '書名未設定';
}

// この関数はAmazonの商品ページ内で実行されるため、外側の変数を参照しない。
function readAmazonProduct() {
  const title = document.querySelector('#productTitle, #ebooksProductTitle')?.textContent.trim();
  const image = document.querySelector('#imgBlkFront, #ebooksImgBlkFront, #landingImage');
  if (!title || !image) throw new Error('商品名または書影が見つかりません。漫画の商品ページを開いてください。');
  const candidates = [];
  if (image.dataset.oldHires) candidates.push(image.dataset.oldHires);
  try {
    const sizes = JSON.parse(image.getAttribute('data-a-dynamic-image') || '{}');
    candidates.push(...Object.keys(sizes).sort((a, b) => sizes[b][0] * sizes[b][1] - sizes[a][0] * sizes[a][1]));
  } catch (_) { /* 通常の画像URLへフォールバック */ }
  candidates.push(image.currentSrc, image.src);
  return { title, urls: [...new Set(candidates.filter(Boolean))] };
}

async function handleAmazonImport() {
  importAmazonBtn.disabled = true;
  importAmazonSeriesBtn.disabled = true;
  amazonImportStatus.textContent = '書影を取得しています…';
  const mode = isZenkanMode ? 'zenkan' : isJogekanMode ? 'jogekan' : 'standard';
  const images = mode === 'zenkan' ? zenkanImages : mode === 'jogekan' ? jogekanImages : null;
  const slot = images ? images.findIndex(image => !image) : -1;
  try {
    if (images && slot < 0) throw new Error('すべての枠に画像があります。差し替える場合は各枠から画像を選択してください。');
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.url || !/^https:\/\/(www\.)?amazon\.co\.jp\//i.test(tab.url)) {
      throw new Error('Amazon.co.jpの商品ページを開いてください。読み取れない場合は、そのページで拡張機能アイコンを押してから再試行してください。');
    }
    const [result] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: readAmazonProduct });
    if (!result?.result) throw new Error('商品情報を取得できませんでした。商品ページの読み込み後に再試行してください。');
    const product = result.result;
    let blob;
    for (const candidate of product.urls) {
      const url = new URL(candidate, tab.url);
      if (url.protocol !== 'https:' || !['m.media-amazon.com', 'images-na.ssl-images-amazon.com', 'images-fe.ssl-images-amazon.com'].includes(url.hostname)) continue;
      try {
        const response = await fetch(url.href, { credentials: 'omit', signal: AbortSignal.timeout(15000) });
        if (!response.ok || !response.headers.get('content-type')?.startsWith('image/')) continue;
        blob = await response.blob();
        break;
      } catch (_) { /* 次の画像候補を試す */ }
    }
    if (!blob) throw new Error('書影を取得できませんでした。画像を保存して手動で選択してください。');
    const objectUrl = URL.createObjectURL(blob);
    const image = new Image();
    try {
      await new Promise((resolve, reject) => {
        image.onload = resolve;
        image.onerror = () => reject(new Error('書影の画像を読み込めませんでした。'));
        image.src = objectUrl;
      });
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
    const currentMode = isZenkanMode ? 'zenkan' : isJogekanMode ? 'jogekan' : 'standard';
    if (currentMode !== mode || (images && images[slot])) throw new Error('取得中に配置が変更されました。もう一度取り込んでください。');
    const file = new File([blob], sanitizeBookTitle(product.title) + '.jpg', { type: blob.type });
    if (mode === 'zenkan') {
      zenkanImages[slot] = image;
      zenkanFiles[slot] = file;
    } else if (mode === 'jogekan') {
      jogekanImages[slot] = image;
      jogekanFiles[slot] = file;
    } else {
      coverImage = image;
      coverImageFile = file;
    }
    bookTitleInput.value = product.title;
    updatePreview();
    amazonImportStatus.textContent = `「${product.title}」を${images ? `画像${slot + 1}に` : ''}取り込みました。`;
  } catch (error) {
    amazonImportStatus.textContent = `取り込み失敗: ${error.message}`;
  } finally {
    importAmazonBtn.disabled = false;
    importAmazonSeriesBtn.disabled = false;
  }
}

// 商品ページ内で同じシリーズの巻番号と書影を読み取る。
async function readAmazonSeries() {
  const normalize = text => text.normalize('NFKC').replace(/\s+/g, '').toLowerCase();
  const parseVolume = title => {
    const text = title.normalize('NFKC').trim();
    const match = text.match(/^(.*?)\s*\(\s*(?:第\s*)?(\d+)\s*巻?\s*\)(?:\s+.*)?$/)
      || text.match(/^(.*?)\s*第?\s*(\d+)\s*巻(?:\s+.*)?$/)
      || text.match(/^(.*?)\s+(\d+)(?:\s+.*)?$/);
    return match && match[1].trim() ? { title: match[1].trim(), volume: Number(match[2]) } : null;
  };
  const title = document.querySelector('#productTitle, #ebooksProductTitle')?.textContent.trim();
  if (!title) throw new Error('漫画の商品ページを開いてください。');
  const current = parseVolume(title);
  const seriesLink = document.querySelector('#seriesBulletWidget_feature_div a[href*="/dp/"], #seriesBulletWidget_feature_div a[href*="/gp/product/"]');
  const seriesTitle = seriesLink?.textContent.trim().replace(/^.*?[:：]\s*/, '') || current?.title;
  if (!seriesTitle) throw new Error('シリーズ名を特定できませんでした。各巻の画像を手動で選択してください。');
  const books = new Map();
  const collect = root => {
    for (const link of root.querySelectorAll('a[href*="/dp/"], a[href*="/gp/product/"]')) {
      const image = link.querySelector('img');
      if (!image) continue;
      const bookTitle = image.alt || link.getAttribute('aria-label') || link.querySelector('[data-test-id="itemTitle"]')?.textContent || '';
      const book = parseVolume(bookTitle);
      if (!book || book.volume < 1 || book.volume > 3 || normalize(book.title) !== normalize(seriesTitle)) continue;
      const url = new URL(link.getAttribute('href'), location.href);
      if (url.origin !== location.origin) continue;
      const asin = url.pathname.match(/\/(?:dp|gp\/product)\/([A-Z0-9]{10})(?:\/|$)/i)?.[1];
      if (!asin) continue;
      const src = image.getAttribute('data-src') || image.getAttribute('src');
      if (!src) continue;
      const imageUrl = new URL(src, location.href).href;
      const urls = [];
      if (image.dataset.oldHires) urls.push(image.dataset.oldHires);
      // Amazonの縮小指定を外した書影を優先し、取得できないときは表示画像を使う。
      urls.push(imageUrl.replace(/\._[^/]+_\.(jpe?g|png|webp)(?:\?.*)?$/i, '.$1'), imageUrl);
      if (!books.has(book.volume)) books.set(book.volume, { title: bookTitle.trim(), volume: book.volume, asin, urls: [...new Set(urls)] });
    }
  };
  collect(document);
  if (books.size < 3 && seriesLink) {
    const url = new URL(seriesLink.getAttribute('href'), location.href);
    if (url.origin === location.origin && /^\/(?:dp|gp\/product)\/[A-Z0-9]{10}(?:\/|$)/i.test(url.pathname)) {
      const response = await fetch(url.href, { signal: AbortSignal.timeout(15000) });
      if (!response.ok) throw new Error('シリーズ一覧を取得できませんでした。しばらくしてから再試行してください。');
      const page = new DOMParser().parseFromString(await response.text(), 'text/html');
      collect(page);
    }
  }
  const missing = [1, 2, 3].filter(volume => !books.has(volume));
  if (missing.length) throw new Error(`同じシリーズの第${missing.join('・')}巻が見つかりません。商品ページのシリーズ一覧を表示してから再試行するか、各枠から画像を選択してください。`);
  const ordered = [1, 2, 3].map(volume => books.get(volume));
  if (new Set(ordered.map(book => book.asin)).size !== 3) throw new Error('各巻を正しく区別できませんでした。各枠から画像を選択してください。');
  return { title: seriesTitle, books: ordered };
}

async function loadAmazonSeriesCover(book) {
  for (const candidate of book.urls) {
    let objectUrl;
    try {
      const url = new URL(candidate);
      if (url.protocol !== 'https:' || !['m.media-amazon.com', 'images-na.ssl-images-amazon.com', 'images-fe.ssl-images-amazon.com'].includes(url.hostname)) continue;
      const response = await fetch(url.href, { credentials: 'omit', signal: AbortSignal.timeout(15000) });
      if (!response.ok || !response.headers.get('content-type')?.startsWith('image/')) continue;
      const blob = await response.blob();
      objectUrl = URL.createObjectURL(blob);
      const image = new Image();
      await new Promise((resolve, reject) => {
        image.onload = resolve;
        image.onerror = () => reject(new Error('書影を読み込めませんでした。'));
        image.src = objectUrl;
      });
      return { image, file: new File([blob], sanitizeBookTitle(book.title) + '.jpg', { type: blob.type }) };
    } catch (_) { /* 次の書影候補を試す */ }
    finally { if (objectUrl) URL.revokeObjectURL(objectUrl); }
  }
  throw new Error(`第${book.volume}巻の書影を取得できませんでした。画像は変更していません。`);
}

async function handleAmazonSeriesImport() {
  importAmazonBtn.disabled = true;
  importAmazonSeriesBtn.disabled = true;
  amazonSeriesStatus.textContent = '同じシリーズの第1〜3巻を探しています…';
  const originalImages = [...zenkanImages];
  const originalFiles = [...zenkanFiles];
  const originalTitle = bookTitleInput.value;
  try {
    if (!isZenkanMode) throw new Error('全巻モードを選択してください。');
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.url || !/^https:\/\/(www\.)?amazon\.co\.jp\//i.test(tab.url)) throw new Error('Amazon.co.jpの商品ページで拡張機能アイコンを押してから再試行してください。');
    const [result] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: readAmazonSeries });
    if (!result?.result) throw new Error('シリーズ情報を取得できませんでした。商品ページの読み込み後に再試行してください。');
    const series = result.result;
    amazonSeriesStatus.textContent = `「${series.title}」の第1〜3巻の書影を取得しています…`;
    const covers = await Promise.all(series.books.map(loadAmazonSeriesCover));
    if (!isZenkanMode || originalImages.some((image, index) => image !== zenkanImages[index]) || originalFiles.some((file, index) => file !== zenkanFiles[index]) || bookTitleInput.value !== originalTitle) {
      throw new Error('取得中に画像・書名・モードが変更されました。もう一度取り込んでください。');
    }
    zenkanImages = covers.map(cover => cover.image);
    zenkanFiles = covers.map(cover => cover.file);
    zenkanInputs.forEach(input => { input.value = ''; });
    bookTitleInput.value = series.title;
    updatePreview();
    amazonSeriesStatus.textContent = `「${series.title}」の第1巻→画像①、第2巻→画像②、第3巻→画像③に取り込みました。保存名：${sanitizeBookTitle(series.title)}全巻サムネ.png`;
  } catch (error) {
    amazonSeriesStatus.textContent = `取り込み失敗: ${error.message}`;
  } finally {
    importAmazonBtn.disabled = false;
    importAmazonSeriesBtn.disabled = false;
  }
}
