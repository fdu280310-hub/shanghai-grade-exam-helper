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
    uploadHint.innerHTML = '图片已上传，正在识别文字... 点击<b>重新选择</b>';
    updateSteps(2);
    textCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
    // Run OCR automatically
    runOCR(e.target.result);
  };
  reader.readAsDataURL(file);
}

// ====== Tesseract.js OCR ======
function runOCR(imageDataUrl) {
  var ocrBox = document.getElementById('ocrLoading');
  var ocrText = document.getElementById('ocrLoadingText');
  var ocrBar = document.getElementById('ocrProgressBar');

  ocrBox.style.display = 'block';
  ocrBar.style.width = '0%';

  Tesseract.recognize(imageDataUrl, 'chi_sim+eng', {
    logger: function(m) {
      if (m.status === 'recognizing text') {
        ocrText.textContent = '正在识别文字... ' + Math.round(m.progress * 100) + '%';
        ocrBar.style.width = Math.round(m.progress * 100) + '%';
      } else if (m.status === 'loading tesseract core' || m.status === 'loading language traineddata') {
        ocrText.textContent = '加载中文识别包（首次约10MB）...';
        if (m.progress) {
          ocrBar.style.width = Math.round(m.progress * 100) + '%';
        }
      } else {
        ocrText.textContent = m.status;
      }
    }
  }).then(function(result) {
    var text = result.data.text.trim();
    if (text) {
      questionText.value = text;
      ocrText.textContent = '识别完成，请核对并修改后点击下载';
      ocrBar.style.width = '100%';
      uploadHint.innerHTML = '文字已自动识别填入下方。点击<b>重新选择</b>';
      showToast('文字识别完成，请核对修改');
    } else {
      ocrText.textContent = '未能识别到文字，请手动输入';
      uploadHint.innerHTML = '图片已上传，请手动输入题目文字。点击<b>重新选择</b>';
    }
  }).catch(function(err) {
    console.error('OCR error:', err);
    ocrText.textContent = '识别失败，请手动输入文字';
    uploadHint.innerHTML = '图片已上传，OCR 失败，请手动输入文字。点击<b>重新选择</b>';
  }).finally(function() {
    setTimeout(function() {
      ocrBox.style.display = 'none';
    }, 1500);
  });
}

// ====== DeepSeek API Call ======
var DEEPSEEK_URL = 'https://api.deepseek.com/chat/completions';

var AI_SYSTEM_PROMPT = `你是一位资深上海高中教师，精通上海等级考命题。你的任务是将外地题目改编为上海等级考格式的大题（含情景引入+10道递进小题）。\n\n## 核心原则\n- 保持原题知识点和核心考点不变\n- 上海等级考最大特色：每个大题必须有真实情景引入，后续小题需能从情景中找到线索\n- 减少纯计算量，增加"说明理由""简述原因""评价方案"等开放性设问\n- 避免"小明在实验室……"等低幼化表述\n\n## 情景引入规范\n- 1-2段文字，写在开头，用"情景："标注\n- 必须是真实、科学的情境，自然衔接到题目\n- 化学常见情景：侯氏制碱法、接触法制硫酸、氯碱工业、含铬废水处理、烟气脱硫脱硝、碳捕集(CCS)、锂电池/钠离子电池、燃料电池、TiO₂光催化、阿司匹林合成、食品添加剂检测、水质分析\n- 物理常见情景：磁悬浮列车原理、卫星变轨、火箭超重失重、电动汽车能量回收、高速公路弯道设计、蹦极/蹦床能量转换、5G电磁波、手机无线充电、CT/MRI原理、光伏发电、风力发电\n\n## 题型与认知层级（10道小题）\n按递进顺序排列：知道→理解→运用→综合\n\n| 题号 | 层级 | 题型 | 说明 |\n|------|------|------|------|\n| 1-2 | 知道 | 单选 | 基础概念识别，4选项(A/B/C/D)，每题1个正确选项 |\n| 3-4 | 理解 | 单选/填空 | 结合情景理解概念，填空可考查化学式、物理量计算等 |\n| 5-6 | 理解 | 不定项/填空 | 不定项需在题干标注"（不定项）"，4选项1~2个正确 |\n| 7-8 | 运用 | 简答/填空 | 分析推理，简答需写"说明理由""简述原因" |\n| 9-10 | 综合 | 计算/论述 | 综合多知识点，计算题保留关键数据，适当减少计算量 |\n\n## 选择题规则\n- 单选：4个选项，不特别标注\n- 不定项：4个选项，题干中标注"（不定项）"，1~2个正确选项\n- 选项格式：A. xxx  B. xxx  C. xxx  D. xxx（两个空格分隔）\n\n## 编号格式\n- 大标题：一、[标题]（黑体14pt居中）\n- 情景：情景：xxx（楷体10.5pt）\n- 小题：1. 2. 3. ...（阿拉伯数字+全角点）\n- 填空：用__________表示空位\n\n## 化学科目特殊要求\n- 情景后加一行：相对原子质量：X-1  Y-2 ...（必须根据题目实际涉及的元素动态列出，不涉及的不要列，不需要的不要多写，只列出题目中真正用到的元素及其原子量，没有涉及的元素一个都不要列）\n- 化学式注意上下标：H₂O写作H2O(下标)，SO₄²⁻写作SO4(下标)2-(上标)\n- 化学方程式使用→或⇌，状态符号用(s)(l)(g)(aq)\n- 有效数字：摩尔质量保留1位小数，pH保留2位小数，平衡常数保留2-3位\n\n## 物理科目特殊要求\n- 不需要相对原子质量行\n- 物理量用常见字母：F(力) m(质量) a(加速度) v(速度) E(能量) B(磁感应强度)\n- 单位用国际单位制：N kg m s Pa J W V A Ω T\n- 数值保留2-3位有效数字，科学记数法用×10ⁿ格式\n- 增加推理过程和实验思想类设问\n\n## 输出要求\n- 输出纯文字，不要markdown代码块，不要用**加粗**或#标题\n- 直接输出完整题目，从"一、"开始\n- 题目输出完毕后，用一行"=====答案与解析====="作为分隔，然后输出所有题目的答案和详细解析\n\n## 答案与解析格式（分隔线之后）
- 每个小题单独一段，格式为"1. [答案]"
- 答案后另起一段"解析：[详细解析]"（物理：推理解题过程、公式推导；化学：反应原理、计算过程）
- 选择题：给出正确选项，每个错误选项一句话说明为什么不选
- 计算题：完整计算步骤；简答题：完整得分点

## 输出格式
一、[情景标题]
情景：[1-2段真实情景引入文字]
相对原子质量：H-1  O-16  Na-23  S-32（仅示例，根据题目实际涉及元素列出，不涉及的不列）
1. [题干]
A. [选项]  B. [选项]  C. [选项]  D. [选项]
2. [题干]
__________
...（共10题）

=====答案与解析=====
1. [答案]
解析：[详细解析过程]

2. [答案]
解析：[详细解析过程]

...（共10题解析）`;

function callDeepSeek(userText, subject) {
  var systemPrompt = AI_SYSTEM_PROMPT;
  // Emphasize the correct subject
  if (subject === '物理') {
    systemPrompt += '\n\n特别注意：本次是物理科目，不需要"相对原子质量"行。';
  } else {
    systemPrompt += '\n\n特别注意：本次是化学科目，必须在情景后添加"相对原子质量"行。';
  }

  // Build user message with OCR text (DeepSeek chat doesn't support images)
  var userContent = '请将以下外地' + subject + '题目改编为上海等级考格式：\n\n' + userText;

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
      loadingText.textContent = '改编完成，正在生成题目文档和解析文档...';

      // Split at separator
      var sepIdx = adaptedText.indexOf('=====答案与解析=====');
      var questionTextPart = adaptedText;
      var answerTextPart = '';

      if (sepIdx !== -1) {
        questionTextPart = adaptedText.substring(0, sepIdx).trim();
        answerTextPart = adaptedText.substring(sepIdx + '=====答案与解析====='.length).trim();
        // Strip leading/trailing newlines from separator
        answerTextPart = answerTextPart.replace(/^[\r\n]+/, '').replace(/[\r\n]+$/, '');
      }

      // Generate question docx
      return buildDocx(questionTextPart, state.subject).then(function(qBlob) {
        var dateStr = new Date().toISOString().slice(0, 10);
        downloadBlob(qBlob, '上海等级考_' + state.subject + '_' + dateStr);
        showToast('题目文档已下载');

        // Generate answer docx if we have answers
        if (answerTextPart) {
          return buildAnswerDocx(answerTextPart, state.subject).then(function(aBlob) {
            downloadBlob(aBlob, '上海等级考_' + state.subject + '_解析_' + dateStr);
            showToast('解析文档已下载');
            showDone();
          });
        } else {
          showDone();
        }
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
function downloadBlob(blob, filename) {
  var a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = (filename || '上海等级考_' + state.subject + '_' + new Date().toISOString().slice(0, 10)) + '.docx';
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

  // Extract relative atomic mass from AI output (dynamic per exam)
  var molarMass = null;
  for (var k = 0; k < lines.length; k++) {
    var m = lines[k].trim().match(/^相对原子质量[：:]\s*(.+)$/);
    if (m) {
      molarMass = m[1].trim();
      // Remove from lines so it won't be re-processed
      lines.splice(k, 1);
      break;
    }
  }

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
  if (subject === '化学' && molarMass) {
    children.push(new Paragraph({
      alignment: AlignmentType.LEFT,
      spacing: { after: 200 },
      children: [new TextRun({
        text: '相对原子质量：' + molarMass,
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

// ====== Answer Docx Builder ======
function buildAnswerDocx(text, subject) {
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
    spacing: { after: 400 },
    children: [new TextRun({
      text: '上海' + subject + '等级考模拟题  参考答案与解析',
      font: { eastAsia: '黑体', ascii: 'Times New Roman', hAnsi: 'Times New Roman', cs: 'Times New Roman' },
      size: 32,
      bold: true
    })]
  }));

  for (var i = 0; i < lines.length; i++) {
    var raw = lines[i];
    var line = raw.trim();

    if (!line) {
      children.push(new Paragraph({
        spacing: { after: 80 },
        children: [new TextRun({ text: '', size: 21 })]
      }));
      continue;
    }

    // Skip the separator line
    if (line.indexOf('=====') === 0) continue;
    if (line === '```' || line === '```text' || line === '```markdown') continue;

    // Question number: "1. A" or "1. 3.2m/s²"
    var numMatch = line.match(/^[（(]?(\d+)[)）.．、\s]+(.*)/);
    if (numMatch) {
      var qNum = numMatch[1];
      var answer = numMatch[2].trim();
      children.push(new Paragraph({
        alignment: AlignmentType.LEFT,
        spacing: { before: 200, after: 80, line: 360 },
        children: [
          new TextRun({
            text: qNum + '. ' + (answer || ''),
            font: { eastAsia: '宋体', ascii: 'Times New Roman', hAnsi: 'Times New Roman', cs: 'Times New Roman' },
            size: 21,
            bold: true
          })
        ]
      }));
      continue;
    }

    // Analysis line: "解析：xxx"
    var analMatch = line.match(/^(解析|【解析】)[：:]\s*/);
    if (analMatch) {
      var analText = line.replace(/^(解析|【解析】)[：:]\s*/, '');
      children.push(new Paragraph({
        alignment: AlignmentType.LEFT,
        spacing: { after: 150, line: 293 },
        indent: { firstLine: 420 },
        children: [new TextRun({
          text: '解析：' + analText,
          font: { eastAsia: '楷体', ascii: 'Times New Roman', hAnsi: 'Times New Roman', cs: 'Times New Roman' },
          size: 21
        })]
      }));
      continue;
    }

    // Any other line: treat as continuation of answer or analysis
    children.push(new Paragraph({
      alignment: AlignmentType.LEFT,
      spacing: { after: 100, line: 293 },
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
