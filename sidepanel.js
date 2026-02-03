// グローバル変数
const DEFAULT_CANVAS_WIDTH = 1280;
const DEFAULT_CANVAS_HEIGHT = 720;
const PADDING_PERCENT = 0.05; // 5%の余白(上下左右)
const TOTAL_PRESETS = 10;

let selectedBackgroundIndex = null;
let selectedBackgroundImage = null;
let coverImage = null;
let coverImageFile = null; // 表紙画像のファイル情報を保存

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
}

// 背景選択
function selectBackground(index, element) {
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

// プレビュー更新
function updatePreview() {
  // 背景画像のサイズに合わせてキャンバスサイズを調整
  let canvasWidth = DEFAULT_CANVAS_WIDTH;
  let canvasHeight = DEFAULT_CANVAS_HEIGHT;

  if (selectedBackgroundImage) {
    // 背景画像の元のサイズを使用
    canvasWidth = selectedBackgroundImage.width;
    canvasHeight = selectedBackgroundImage.height;
  }

  // キャンバスサイズを設定
  previewCanvas.width = canvasWidth;
  previewCanvas.height = canvasHeight;

  // キャンバスをクリア
  ctx.clearRect(0, 0, canvasWidth, canvasHeight);

  // 背景画像を描画
  if (selectedBackgroundImage) {
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
  const x = (canvasWidth - drawWidth) / 2;
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
  if (!selectedBackgroundImage && !coverImage) {
    alert('背景画像または表紙画像を選択してください');
    return;
  }

  // ファイル名を生成
  let filename = 'thumbnail';

  if (coverImageFile) {
    // 元画像のファイル名(拡張子を除く)
    const originalName = coverImageFile.name.replace(/\.[^/.]+$/, '');

    // タイムスタンプ(年月日時分)
    const now = new Date();
    const timestamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;

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
