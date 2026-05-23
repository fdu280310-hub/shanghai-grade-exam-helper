const state = {
  subject: '化学',
  questionImage: null,
  questionText: ''
};

// ====== Step Indicator ======
function updateSteps(active) {
  for (let i = 1; i <= 4; i++) {
    const dot = document.getElementById('dot' + i);
    const line = document.getElementById('line' + i);
    if (!dot) continue;
    dot.classList.remove('active', 'done');
    if (i < active) dot.classList.add('done');
    if (i === active) dot.classList.add('active');
    if (line) {
      line.classList.remove('done');
      if (i < active) line.classList.add('done');
    }
  }
}

// ====== Subject Selection ======
document.getElementById('subjectRow').addEventListener('click', (e) => {
  const btn = e.target.closest('.subject-btn');
  if (!btn) return;
  document.querySelectorAll('.subject-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  state.subject = btn.dataset.subject;
});

// ====== File Upload ======
const uploadArea = document.getElementById('uploadArea');
const fileInput = document.getElementById('fileInput');
const previewImg = document.getElementById('previewImg');
const textCard = document.getElementById('textCard');
const questionText = document.getElementById('questionText');
const uploadIcon = document.getElementById('uploadIcon');
const uploadHint = document.getElementById('uploadHint');

uploadArea.addEventListener('click', () => fileInput.click());

fileInput.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;
  handleImage(file);
});

// Drag and drop
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
    uploadIcon.textContent = '✅';
    uploadHint.innerHTML = '图片已上传，点击<b>重新选择</b>';
    questionText.value = '（题目图片已上传，文字识别由 Claude Code 在桌面端处理。\n你也可以在此手动输入或粘贴题目文字，供 Claude 直接参考。）';
    updateSteps(3);
  };
  reader.readAsDataURL(file);
}

// ====== Generate Prompt ======
document.getElementById('generateBtn').addEventListener('click', () => {
  state.questionText = questionText.value.trim();
  if (!state.questionText) {
    showToast('请先输入或确认题目文字');
    return;
  }

  const subject = state.subject;

  const prompt = '请使用 shanghai-grade-exam-helper skill，将以下外地' + subject + '题目改编为上海等级考格式的 Word 文档。\n\n科目：' + subject + '\n题目内容：\n' + state.questionText + '\n\n要求：\n1. 仔细研读上述素材，提取关键知识点\n2. 借助搜索引擎充实知识准备\n3. 按上海等级考10题递进认知层级出题：知道→理解→运用→综合\n4. 添加合适的情景引入（情景化命题，楷体显示）\n5. 按上海等级考格式调整题型和编号\n6. 如果是化学题，记得加相对原子质量行\n7. 生成 .docx 文件';

  document.getElementById('promptBox').textContent = prompt;
  document.getElementById('promptBox').className = 'prompt-box show';
  document.getElementById('resultCard').style.display = 'block';
  document.getElementById('helpCard').style.display = 'none';

  updateSteps(4);

  document.getElementById('resultCard').scrollIntoView({ behavior: 'smooth', block: 'center' });
});

// ====== Copy ======
document.getElementById('copyBtn').addEventListener('click', () => {
  const text = document.getElementById('promptBox').textContent;
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(() => {
      showToast('✅ 提示词已复制！粘贴到 Claude Code 使用');
    }).catch(() => {
      fallbackCopy(text);
    });
  } else {
    fallbackCopy(text);
  }
});

function fallbackCopy(text) {
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.position = 'fixed'; ta.style.left = '-9999px';
  document.body.appendChild(ta);
  ta.select();
  try { document.execCommand('copy'); showToast('✅ 提示词已复制！'); }
  catch (e) { showToast('复制失败，请手动选择复制'); }
  document.body.removeChild(ta);
}

// ====== New Question ======
document.getElementById('newQuestionBtn').addEventListener('click', () => {
  state.questionImage = null;
  state.questionText = '';
  previewImg.style.display = 'none';
  previewImg.src = '';
  textCard.style.display = 'none';
  document.getElementById('resultCard').style.display = 'none';
  document.getElementById('helpCard').style.display = 'block';
  document.getElementById('promptBox').className = 'prompt-box';
  questionText.value = '';
  fileInput.value = '';
  uploadIcon.textContent = '📷';
  uploadHint.innerHTML = '点击<b>拍照</b>或<b>选择图片</b><br><span style="font-size:12px;color:#94a3b8">支持截图、照片、PDF 截图</span>';
  updateSteps(1);
  window.scrollTo({ top: 0, behavior: 'smooth' });
});

// ====== Toast ======
let toastTimer;
function showToast(msg) {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 2200);
}
