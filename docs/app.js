// ====== State ======
var state = {
  subject: '化学',
  questionImage: null,
  questionImageData: null,
  questionText: '',
  apiKey: ''
};

// Load saved API key
try {
  state.apiKey = localStorage.getItem('ds_api_key') || '';
} catch(e) {}

// ====== Step Indicator (3 steps) ======
function updateSteps(active) {
  for (var i = 1; i <= 3; i++) {
    var dot = document.getElementById('dot' + i);
    var line = document.getElementById('line' + i);
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

// ====== API Key Management ======
var apiToggle = document.getElementById('apiToggle');
var apiSettings = document.getElementById('apiSettings');
var apiKeyInput = document.getElementById('apiKeyInput');
var apiStatus = document.getElementById('apiStatus');
var apiBadge = document.getElementById('apiBadge');

function updateApiUI() {
  if (state.apiKey) {
    apiKeyInput.value = state.apiKey.slice(0, 8) + '...' + state.apiKey.slice(-4);
    apiStatus.textContent = 'Key 已保存（仅存本地浏览器，不上传服务器）';
    apiStatus.className = 'api-status ok';
    apiBadge.textContent = '已设置';
    apiBadge.style.color = '#10b981';
  } else {
    apiKeyInput.value = '';
    apiStatus.textContent = '未设置 Key，将仅做排版不做 AI 改编';
    apiStatus.className = 'api-status none';
    apiBadge.textContent = '未设置';
    apiBadge.style.color = '#94a3b8';
  }
}
updateApiUI();

apiToggle.addEventListener('click', function() {
  apiSettings.classList.toggle('show');
  if (apiSettings.classList.contains('show')) {
    if (state.apiKey) {
      apiKeyInput.value = state.apiKey;
    } else {
      apiKeyInput.value = '';
    }
  }
});

document.getElementById('saveApiKeyBtn').addEventListener('click', function() {
  var val = apiKeyInput.value.trim();
  if (!val) {
    showToast('请输入 API Key');
    return;
  }
  if (val.indexOf('...') > -1 && state.apiKey) return; // masked, keep old
  state.apiKey = val;
  try { localStorage.setItem('ds_api_key', val); } catch(e) {}
  updateApiUI();
  showToast('API Key 已保存');
});

document.getElementById('clearApiKeyBtn').addEventListener('click', function() {
  state.apiKey = '';
  try { localStorage.removeItem('ds_api_key'); } catch(e) {}
  updateApiUI();
  apiKeyInput.value = '';
  showToast('API Key 已清除');
});

// ====== Subject Selection ======
document.getElementById('subjectRow').addEventListener('click', function(e) {
  var btn = e.target.closest('.subject-btn');
  if (!btn) return;
  document.querySelectorAll('.subject-btn').forEach(function(b) { b.classList.remove('active'); });
  btn.classList.add('active');
  state.subject = btn.dataset.subject;
});

// ====== File Upload ======
var uploadArea = document.getElementById('uploadArea');
var fileInput = document.getElementById('fileInput');
var previewImg = document.getElementById('previewImg');
var textCard = document.getElementById('textCard');
var questionText = document.getElementById('questionText');
var uploadIcon = document.getElementById('uploadIcon');
var uploadHint = document.getElementById('uploadHint');

uploadArea.addEventListener('click', function() { fileInput.click(); });

fileInput.addEventListener('change', function(e) {
  var file = e.target.files[0];
  if (!file) return;
  handleImage(file);
});

uploadArea.addEventListener('dragover', function(e) { e.preventDefault(); uploadArea.classList.add('drag-over'); });
uploadArea.addEventListener('dragleave', function() { uploadArea.classList.remove('drag-over'); });
uploadArea.addEventListener('drop', function(e) {
  e.preventDefault();
  uploadArea.classList.remove('drag-over');
  var file = e.dataTransfer.files[0];
  if (file && file.type.indexOf('image/') === 0) handleImage(file);
});

function handleImage(file) {
  state.questionImage = file;
  var reader = new FileReader();
  reader.onload = function(e) {
    state.questionImageData = e.target.result;
    previewImg.src = e.target.result;
    previewImg.style.display = 'block';
    textCard.style.display = 'block';
    uploadIcon.textContent = 'OK';
    uploadHint.innerHTML = '图片已上传，AI 将直接读取图片内容。点击<b>重新选择</b>';
    updateSteps(2);
    textCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };
  reader.readAsDataURL(file);
}

// ====== DeepSeek API Call ======
var DEEPSEEK_URL = 'https://api.deepseek.com/chat/completions';

var AI_SYSTEM_PROMPT = '你是一位资深上海高中教师，精通上海等级考（高考）命题规律。你的任务是将用户提供的外地题目改编为上海等级考格式。\n\n要求：\n1. 分析原题的知识点，保持核心考点不变\n2. 添加真实的情景引入（工业生产、科研成果、生活应用、环保等），用一短段文字写在开头，标注"情景："\n3. 按递进认知层级出 10 道小题：知道→理解→运用→综合，用"一、"做大标题\n4. 题型混合：选择（单选+不定项标注）、填空、简答、计算\n5. 子题编号用小标题：1. 2. 3. ...，选项用 A. B. C. D.\n6. 化学题需在情景后加"相对原子质量："行\n7. 保留原题的关键数据和图表描述\n8. 输出纯文字，不要 markdown 代码块，不要用 ** 加粗，直接输出题目内容\n\n输出格式示例：\n一、[情景标题]\n情景：xxx（楷体风格的情景引入文字）\n相对原子质量：H-1 C-12 ...（仅化学）\n1. [题干]\nA. [选项]  B. [选项]  C. [选项]  D. [选项]\n2. [题干]\n__________\n...（共10题）';

function callDeepSeek(userText, subject) {
  var systemPrompt = AI_SYSTEM_PROMPT;
  if (subject === '物理') {
    systemPrompt = systemPrompt.replace('化学题需在情景后加"相对原子质量："行', '物理题不需要相对原子质量');
  }

  // Build user message: include image if available (DeepSeek Vision)
  var userContent;
  if (state.questionImageData) {
    userContent = [
      { type: 'image_url', image_url: { url: state.questionImageData } },
      { type: 'text', text: '请将以上图片中的外地' + subject + '题目改编为上海等级考格式。' + (userText ? '\n\n以下是我手动输入的文字供参考：\n' + userText : '') }
    ];
  } else {
    userContent = '请将以下外地' + subject + '题目改编为上海等级考格式：\n\n' + userText;
  }

  return fetch(DEEPSEEK_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + state.apiKey
    },
    body: JSON.stringify({
      model: 'deepseek-chat',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userContent }
      ],
      temperature: 0.7,
      max_tokens: 4096
    })
  }).then(function(res) {
    if (!res.ok) {
      return res.json().then(function(err) {
        throw new Error(err.error && err.error.message ? err.error.message : ('API 请求失败 (' + res.status + ')'));
      });
    }
    return res.json();
  }).then(function(data) {
    if (!data.choices || !data.choices[0] || !data.choices[0].message) {
      throw new Error('API 返回格式异常');
    }
    return data.choices[0].message.content;
  });
}

// ====== AI Download ======
var loadingBox = document.getElementById('loadingBox');
var loadingText = document.getElementById('loadingText');

document.getElementById('aiDownloadBtn').addEventListener('click', function() {
  var text = questionText.value.trim();
  if (!text && !state.questionImageData) {
    showToast('请先上传题目图片或输入文字内容');
    return;
  }

  if (!state.apiKey) {
    showToast('请先设置 DeepSeek API Key（在步骤1底部）');
    apiSettings.classList.add('show');
    apiKeyInput.focus();
    return;
  }

  startAI(text);
});

function startAI(text) {
  var aiBtn = document.getElementById('aiDownloadBtn');
  var directBtn = document.getElementById('directDownloadBtn');
  aiBtn.disabled = true;
  directBtn.disabled = true;
  aiBtn.textContent = 'AI 分析中...';
  loadingBox.classList.add('show');
  loadingText.textContent = 'DeepSeek 正在分析题目并改编为等级考格式...';
  textCard.scrollIntoView({ behavior: 'smooth', block: 'center' });

  callDeepSeek(text, state.subject)
    .then(function(adaptedText) {
      loadingText.textContent = '改编完成，正在生成 .docx 文件...';
      return buildDocx(adaptedText, state.subject).then(function(blob) {
        downloadBlob(blob);
        showDone();
      });
    })
    .catch(function(e) {
      console.error(e);
      showToast('AI 改编失败：' + e.message);
    })
    .finally(function() {
      aiBtn.disabled = false;
      directBtn.disabled = false;
      aiBtn.textContent = 'AI 智能改编并下载 .docx';
      loadingBox.classList.remove('show');
    });
}

// ====== Direct Download (no AI) ======
document.getElementById('directDownloadBtn').addEventListener('click', function() {
  var text = questionText.value.trim();
  if (!text) {
    showToast('请先输入题目内容');
    return;
  }

  var btn = document.getElementById('directDownloadBtn');
  var orig = btn.textContent;
  btn.textContent = '生成中...';
  btn.disabled = true;

  buildDocx(text, state.subject)
    .then(function(blob) {
      downloadBlob(blob);
      showDone();
    })
    .catch(function(e) {
      console.error(e);
      showToast('生成失败：' + (e.message || '请检查文字格式'));
    })
    .finally(function() {
      btn.textContent = orig;
      btn.disabled = false;
    });
});

// ====== Shared ======
function downloadBlob(blob) {
  var a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = '上海等级考_' + state.subject + '_' + new Date().toISOString().slice(0, 10) + '.docx';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(a.href);
}

function showDone() {
  document.getElementById('doneCard').style.display = 'block';
  document.getElementById('helpCard').style.display = 'none';
  updateSteps(3);
  document.getElementById('doneCard').scrollIntoView({ behavior: 'smooth', block: 'center' });
  showToast('docx 文件已下载！');
}

// ====== Docx Builder ======
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

    // Skip markdown code blocks
    if (line === '```' || line === '```text' || line === '```markdown') continue;

    // Scenario: starts with 情景 or 背景 or 【情景】 or 【背景】
    var scenarioMatch = line.match(/^(情景|背景|【情景|【背景)/);
    if (scenarioMatch && !sawScenario) {
      sawScenario = true;
      var scenarioLines = [line];
      var j = i + 1;
      while (j < lines.length) {
        var nextLine = lines[j].trim();
        if (nextLine && !nextLine.match(/^[一二三四五六七八九十][、，,.]/) && !nextLine.match(/^[（(]?\d+[)）.．、]/) && !nextLine.match(/^[A-D][.．、]/) && !nextLine.match(/^相对原子质量/)) {
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

    // Relative atomic mass line (skip if already added above)
    if (line.indexOf('相对原子质量') === 0 && subject === '化学') continue;

    // Big question header
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

    // Sub question
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

    // Options
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
document.getElementById('newQuestionBtn').addEventListener('click', function() {
  state.questionImage = null;
  state.questionImageData = null;
  state.questionText = '';
  previewImg.style.display = 'none';
  previewImg.src = '';
  textCard.style.display = 'block';
  document.getElementById('doneCard').style.display = 'none';
  document.getElementById('helpCard').style.display = 'block';
  questionText.value = '';
  fileInput.value = '';
  uploadIcon.textContent = '';
  uploadHint.innerHTML = '点击<b>拍照</b>或<b>选择图片</b>（AI 将直接读取图片内容）<br><span style="font-size:12px;color:#94a3b8">也可跳过，直接在下方文本框粘贴题目文字</span>';
  updateSteps(2);
  window.scrollTo({ top: 0, behavior: 'smooth' });
});

// ====== Init ======
textCard.style.display = 'block';
updateSteps(2);

questionText.addEventListener('focus', function() {
  if (textCard.style.display === 'none') {
    textCard.style.display = 'block';
    updateSteps(2);
  }
});

// ====== Toast ======
var toastTimer;
function showToast(msg) {
  var toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(function() { toast.classList.remove('show'); }, 2200);
}
