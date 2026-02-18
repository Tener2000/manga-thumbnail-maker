// グローバル変数
const DEFAULT_CANVAS_WIDTH = 1280;
const DEFAULT_CANVAS_HEIGHT = 720;
const PADDING_PERCENT = 0.05; // 5%の余白(上下左右)
const TOTAL_PRESETS = 10;

let selectedBackgroundIndex = null;
let selectedBackgroundImage = null;
let coverImage = null;
let coverImageFile = null; // 表紙画像のファイル情報を保存
let currentPosition = 'center'; // 'center' or 'left'

// 全巻特典用変数
let isZenkanMode = false;
let zenkanImages = [null, null, null]; // [img1, img2, img3]
let zenkanFiles = [null, null, null];
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
const slotNumberInput = document.getElementById('slotNumber');
const registerImageInput = document.getElementById('registerImageInput');
const registerBtn = document.getElementById('registerBtn');
const coverImageInput = document.getElementById('coverImageInput');
const uploadBtn = document.getElementById('uploadBtn');
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

// 初期化
document.addEventListener('DOMContentLoaded', async () => {
  await loadPresets();
  setupEventListeners();
  drawInitialCanvas();
});

// イベントリスナー設定
function setupEventListeners() {
  registerBtn.addEventListener('click', () => registerImageInput.click());
  registerImageInput.addEventListener('change', handleRegisterImage);

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

  downloadBtn.addEventListener('click', downloadImage);
}

// プリセット読み込み
async function loadPresets() {
  presetGrid.innerHTML = '';

  // Chrome Storageからユーザー登録画像を取得
  const result = await chrome.storage.local.get('userBackgrounds');
  const userBackgrounds = result.userBackgrounds || {};

  for (let i = 1; i <= TOTAL_PRESETS; i++) {
    const presetItem = document.createElement('div');
    presetItem.className = 'preset-item';
    presetItem.dataset.index = i;

    const numberLabel = document.createElement('div');
    numberLabel.className = 'preset-number';
    numberLabel.textContent = i;
    presetItem.appendChild(numberLabel);

    // デフォルト背景(1-6)またはユーザー登録背景
    if (i <= 6) {
      const img = document.createElement('img');
      img.src = `backgrounds/bg${i}.png`;
      img.alt = `背景 ${i}`;
      presetItem.appendChild(img);
    } else if (userBackgrounds[i]) {
      const img = document.createElement('img');
      img.src = userBackgrounds[i];
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
  presetGrid.appendChild(zenkanPreset);
}

// 背景選択
function selectBackground(index, element) {
  // モードリセット
  isZenkanMode = false;
  toggleInputSection(false);

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
  toggleInputSection(true);

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

function toggleInputSection(isZenkan) {
  if (isZenkan) {
    standardCoverSection.style.display = 'none';
    zenkanCoverSection.style.display = 'block';
  } else {
    standardCoverSection.style.display = 'block';
    zenkanCoverSection.style.display = 'none';
  }
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

    // プリセットを再読み込み
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
// プレビュー更新
function updatePreview() {
  // 背景画像のサイズに合わせてキャンバスサイズを調整
  let canvasWidth = DEFAULT_CANVAS_WIDTH;
  let canvasHeight = DEFAULT_CANVAS_HEIGHT;

  if (isZenkanMode) {
    // 全巻モードは1280x1280固定
    canvasWidth = 1280;
    canvasHeight = 1280;
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
  ZENKAN_COORDS.forEach((coord, i) => {
    const img = zenkanImages[i];
    if (img) {
      // アスペクト比維持で枠内を埋める (object-fit: cover)
      const imgAspect = img.width / img.height;
      const areaAspect = coord.w / coord.h;

      let drawW, drawH, drawX, drawY;

      if (imgAspect > areaAspect) {
        // 画像の方が横長 -> 高さを合わせる
        drawH = coord.h;
        drawW = coord.h * imgAspect;
        drawX = coord.x + (coord.w - drawW) / 2;
        drawY = coord.y;
      } else {
        // 画像の方が縦長 -> 幅を合わせる
        drawW = coord.w;
        drawH = coord.w / imgAspect;
        drawX = coord.x;
        drawY = coord.y + (coord.h - drawH) / 2;
      }

      // クリップして描画
      ctx.save();
      ctx.beginPath();
      ctx.rect(coord.x, coord.y, coord.w, coord.h);
      ctx.clip();
      ctx.drawImage(img, drawX, drawY, drawW, drawH);
      ctx.restore();
    } else {
      // プレースホルダー番号
      ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
      ctx.fillRect(coord.x, coord.y, coord.w, coord.h);

      ctx.fillStyle = '#fff';
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
  if (isZenkanMode) {
    if (!zenkanImages.some(img => img !== null)) {
      alert('少なくとも1枚の画像をアップロードしてください');
      return;
    }
  } else if (!selectedBackgroundImage && !coverImage) {
    alert('背景画像または表紙画像を選択してください');
    return;
  }

  // ファイル名を生成
  let filename = 'thumbnail';

  if (isZenkanMode) {
    // 全巻モードのファイル名
    const timestamp = getTimestamp();
    filename = `zenkan_thumbnail_${timestamp}`;
  } else if (coverImageFile) {
    // 元画像のファイル名(拡張子を除く)
    const originalName = coverImageFile.name.replace(/\.[^/.]+$/, '');
    // タイムスタンプ(年月日時分)
    const timestamp = getTimestamp();
    filename = `${originalName}_サムネ_${timestamp}`;
  } else {
    // 表紙画像がない場合はタイムスタンプのみ
    filename = `thumbnail_${Date.now()}`;
  }

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
