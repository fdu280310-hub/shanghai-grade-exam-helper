const state = {
  subject: '化学',
  questionImage: null,
  questionText: ''
};

// ---- Subject Selection ----
document.getElementById('subjectRow').addEventListener('click', (e) => {
  const btn = e.target.closest('.subject-btn');
  if (!btn) return;
  document.querySelectorAll('.subject-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  state.subject = btn.dataset.subject;
});

// ---- File Upload ----
const uploadArea = document.getElementById('uploadArea');
const fileInput = document.getElementById('fileInput');
const previewImg = document.getElementById('previewImg');
const textCard = document.getElementById('textCard');
const questionText = document.getElementById('questionText');

uploadArea.addEventListener('click', () => fileInput.click());

fileInput.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;
  handleImage(file);
});

// Drag and drop (desktop)
uploadArea.addEventListener('dragover', (e) => { e.preventDefault(); uploadArea.classList.add('drag-over'); });
uploadArea.addEventListener('dragleave', () => uploadArea.classList.remove('drag-over'));
uploadArea.addEventListener('drop', (e) => {
  e.preventDefault();
  uploadArea.classList.remove('drag-over');
  const file = e.dataTransfer.files[0];
  if (file && file.type.startsWith('image/')) handleImage(file);
});

function handleImage(file) {
  state.questionImage = file;
  const reader = new FileReader();
  reader.onload = (e) => {
    previewImg.src = e.target.result;
    previewImg.style.display = 'block';
    textCard.style.display = 'block';
    uploadArea.querySelector('.icon').textContent = '✅';
    uploadArea.querySelector('.hint').innerHTML = '图片已上传，点击<strong>重新选择</strong>';
    // Place OCR hint
    questionText.value = '（题目图片已上传，文字识别由 Claude Code 在桌面端处理。\n你也可以在此手动输入或粘贴题目文字，供 Claude 直接参考。）';
  };
  reader.readAsDataURL(file);
}

// ---- Generate Prompt ----
document.getElementById('generateBtn').addEventListener('click', () => {
  state.questionText = questionText.value.trim();
  if (!state.questionText) {
    showToast('请先输入或确认题目文字');
    return;
  }

  const subject = state.subject;
  const prompt = `请使用 shanghai-grade-exam-helper skill，将以下外地${subject}题目改编为上海等级考格式的 Word 文档。

科目：${subject}
题目内容：
${state.questionText}

要求：
1. 添加合适的情景引入（情景化命题）
2. 按上海等级考格式调整题型和编号
3. 如果是化学题，记得加相对原子质量行
4. 生成 .docx 文件`;

  document.getElementById('promptBox').textContent = prompt;
  document.getElementById('promptBox').style.display = 'block';
  document.getElementById('resultCard').style.display = 'block';
  document.getElementById('helpCard').style.display = 'none';

  // Scroll to result
  document.getElementById('resultCard').scrollIntoView({ behavior: 'smooth' });
});

// ---- Copy ----
document.getElementById('copyBtn').addEventListener('click', () => {
  const text = document.getElementById('promptBox').textContent;
  navigator.clipboard.writeText(text).then(() => {
    showToast('提示词已复制！粘贴到 Claude Code 中使用');
  }).catch(() => {
    showToast('复制失败，请手动选择复制');
  });
});

// ---- New Question ----
document.getElementById('newQuestionBtn').addEventListener('click', () => {
  state.questionImage = null;
  state.questionText = '';
  previewImg.style.display = 'none';
  previewImg.src = '';
  textCard.style.display = 'none';
  document.getElementById('resultCard').style.display = 'none';
  document.getElementById('helpCard').style.display = 'block';
  document.getElementById('promptBox').style.display = 'none';
  questionText.value = '';
  fileInput.value = '';
  uploadArea.querySelector('.icon').textContent = '📷';
  uploadArea.querySelector('.hint').innerHTML = '点击<strong>拍照</strong>或<strong>选择图片</strong>';
  window.scrollTo({ top: 0, behavior: 'smooth' });
});

// ---- Toast ----
function showToast(msg) {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2000);
}

// ---- PWA ----
if ('serviceWorker' in navigator) {
  // Minimal service worker for offline caching could be added here
}
