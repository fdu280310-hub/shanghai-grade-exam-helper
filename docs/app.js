const state = {
  subject: '化学',
  questionImage: null,
  questionText: ''
};

// ====== Step Indicator (3 steps) ======
function updateSteps(active) {
  for (let i = 1; i <= 3; i++) {
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
    uploadIcon.textContent = 'OK';
    uploadHint.innerHTML = '图片已上传，点击<b>重新选择</b>';
    if (!questionText.value || questionText.value.indexOf('图片已上传') === 0) {
      questionText.value = '';
    }
    updateSteps(2);
    textCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };
  reader.readAsDataURL(file);
}

// ====== Direct Docx Download ======
document.getElementById('downloadBtn').addEventListener('click', () => {
  state.questionText = questionText.value.trim();
  if (!state.questionText) {
    showToast('请先输入题目内容');
    return;
  }
  generateAndDownloadDocx();
});

async function generateAndDownloadDocx() {
  const btn = document.getElementById('downloadBtn');
  const origText = btn.textContent;
  btn.textContent = '生成中...';
  btn.disabled = true;

  try {
    const blob = await buildDocx(state.questionText, state.subject);
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = '上海等级考_' + state.subject + '_' + new Date().toISOString().slice(0, 10) + '.docx';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(a.href);

    document.getElementById('doneCard').style.display = 'block';
    document.getElementById('helpCard').style.display = 'none';
    updateSteps(3);
    document.getElementById('doneCard').scrollIntoView({ behavior: 'smooth', block: 'center' });
    showToast('docx 文件已下载！');
  } catch (e) {
    console.error(e);
    showToast('生成失败：' + (e.message || '请检查文字格式'));
  } finally {
    btn.textContent = origText;
    btn.disabled = false;
  }
}

function buildDocx(text, subject) {
  var D = window.docx;
  if (!D) throw new Error('docx 库加载失败，请检查网络连接');

  var Document = D.Document;
  var Packer = D.Packer;
  var Paragraph = D.Paragraph;
  var TextRun = D.TextRun;
  var AlignmentType = D.AlignmentType;

  var lines = text.split('\n');
  var children = [];

  // Title
  children.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 360 },
    children: [new TextRun({
      text: '上海' + subject + '等级考模拟题',
      font: { eastAsia: '黑体', ascii: 'Times New Roman', hAnsi: 'Times New Roman', cs: 'Times New Roman' },
      size: 32,
      bold: true
    })]
  }));

  // Relative atomic mass for chemistry
  if (subject === '化学') {
    children.push(new Paragraph({
      alignment: AlignmentType.LEFT,
      spacing: { after: 200 },
      children: [new TextRun({
        text: '相对原子质量：H-1  C-12  N-14  O-16  Na-23  S-32  Cl-35.5  Fe-56',
        font: { eastAsia: '宋体', ascii: 'Times New Roman', hAnsi: 'Times New Roman', cs: 'Times New Roman' },
        size: 21
      })]
    }));
  }

  var bigLabels = '一二三四五六七八九十';
  var sawScenario = false;

  for (var i = 0; i < lines.length; i++) {
    var raw = lines[i];
    var line = raw.trim();

    // Empty line
    if (!line) {
      children.push(new Paragraph({
        spacing: { after: 120 },
        children: [new TextRun({ text: '', size: 21 })]
      }));
      continue;
    }

    // Scenario: starts with 情景 or 背景 or 【情景】 or 【背景】
    var scenarioMatch = line.match(/^(情景|背景|【情景|【背景)/);
    if (scenarioMatch && !sawScenario) {
      sawScenario = true;
      var scenarioLines = [line];
      var j = i + 1;
      // Collect consecutive scenario lines
      while (j < lines.length) {
        var nextLine = lines[j].trim();
        if (nextLine && !nextLine.match(/^[一二三四五六七八九十][、，,.]/) && !nextLine.match(/^[（(]?\d+[)）.．、]/) && !nextLine.match(/^[A-D][.．、]/)) {
          scenarioLines.push(nextLine);
          j++;
        } else {
          break;
        }
      }
      i = j - 1;
      children.push(new Paragraph({
        alignment: AlignmentType.LEFT,
        spacing: { after: 280, line: 360 },
        indent: { firstLine: 420 },
        children: [new TextRun({
          text: scenarioLines.join('\n'),
          font: { eastAsia: '楷体', ascii: 'Times New Roman', hAnsi: 'Times New Roman', cs: 'Times New Roman' },
          size: 21
        })]
      }));
      continue;
    }

    // Big question header: "一、" "二、" etc.
    var bigMatch = line.match(/^([一二三四五六七八九十])[、，,.]\s*/);
    if (bigMatch) {
      var label = bigMatch[1];
      var rest = line.replace(/^[一二三四五六七八九十][、，,.]\s*/, '');
      children.push(new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 280, after: 200 },
        children: [new TextRun({
          text: label + '、' + (rest || '综合题'),
          font: { eastAsia: '黑体', ascii: 'Times New Roman', hAnsi: 'Times New Roman', cs: 'Times New Roman' },
          size: 28,
          bold: true
        })]
      }));
      continue;
    }

    // Sub question: "1." "2)" "（1）" etc.
    var subMatch = line.match(/^[（(]?(\d+)[)）.．、\s]+/);
    if (subMatch) {
      children.push(new Paragraph({
        alignment: AlignmentType.LEFT,
        spacing: { after: 180, line: 360 },
        children: [new TextRun({
          text: line,
          font: { eastAsia: '宋体', ascii: 'Times New Roman', hAnsi: 'Times New Roman', cs: 'Times New Roman' },
          size: 21
        })]
      }));
      continue;
    }

    // Options: "A." "B．" "A、" etc.
    var optMatch = line.match(/^([A-D])[.．、\s]+/);
    if (optMatch) {
      var parts = line.split(/[\t]{1,}|\s{2,}/);
      var runs = [];
      for (var k = 0; k < parts.length; k++) {
        if (k > 0) runs.push(new TextRun({ text: '\t', size: 21 }));
        runs.push(new TextRun({
          text: parts[k].trim(),
          font: { eastAsia: '宋体', ascii: 'Times New Roman', hAnsi: 'Times New Roman', cs: 'Times New Roman' },
          size: 21
        }));
      }
      children.push(new Paragraph({
        alignment: AlignmentType.LEFT,
        spacing: { after: 100, line: 360 },
        children: runs
      }));
      continue;
    }

    // Regular body text
    children.push(new Paragraph({
      alignment: AlignmentType.LEFT,
      spacing: { after: 180, line: 293 },
      indent: { firstLine: 420 },
      children: [new TextRun({
        text: line,
        font: { eastAsia: '宋体', ascii: 'Times New Roman', hAnsi: 'Times New Roman', cs: 'Times New Roman' },
        size: 21
      })]
    }));
  }

  var doc = new Document({
    sections: [{
      properties: {
        page: {
          size: { width: 11906, height: 16838 },
          margin: { top: 1440, bottom: 1440, left: 1800, right: 1800 }
        }
      },
      children: children
    }]
  });

  return Packer.toBlob(doc);
}

// ====== New Question ======
document.getElementById('newQuestionBtn').addEventListener('click', () => {
  state.questionImage = null;
  state.questionText = '';
  previewImg.style.display = 'none';
  previewImg.src = '';
  textCard.style.display = 'none';
  document.getElementById('doneCard').style.display = 'none';
  document.getElementById('helpCard').style.display = 'block';
  questionText.value = '';
  fileInput.value = '';
  uploadIcon.textContent = '';
  uploadHint.innerHTML = '点击<b>拍照</b>或<b>选择图片</b>（图片仅供自己参考）<br><span style="font-size:12px;color:#94a3b8">也可跳过此步，直接在下方文本框粘贴题目文字</span>';
  updateSteps(1);
  window.scrollTo({ top: 0, behavior: 'smooth' });
});

// Also show textCard when user clicks on textarea hint — always make step 3 accessible
document.getElementById('questionText').addEventListener('focus', () => {
  if (textCard.style.display === 'none') {
    textCard.style.display = 'block';
    updateSteps(2);
  }
});

// Show textCard on page load so users can directly paste text (no image needed)
textCard.style.display = 'block';
updateSteps(2);

// ====== Toast ======
var toastTimer;
function showToast(msg) {
  var toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(function() { toast.classList.remove('show'); }, 2200);
}
