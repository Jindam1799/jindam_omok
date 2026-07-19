const BOARD_SIZE = 15;
let currentPlayer = 'black';
let boardState = [];
let gameOver = false;

let pendingRow = -1;
let pendingCol = -1;
let currentLessonPool = [];
let currentQuizObj = null;
let currentChoices = [];
let correctIndex = -1;
let reviewLog = [];

let moveHistory = [];
let undoCount = 2;
let currentQuestionVoice = null;
let currentAnswerVoice = null;

const correctMessages = [
  { cn: '绝妙！', kr: '기막힌 묘수로군!' },
  { cn: '厉害！', kr: '대단하오!' },
  { cn: '佩服！', kr: '감탄했소!' },
  { cn: '完美无瑕！', kr: '완벽하오!' },
];
const wrongMessages = [
  { cn: '可惜！', kr: '아깝도다!' },
  { cn: '大意了！', kr: '방심했군!' },
  { cn: '差之毫厘！', kr: '아주 조금 어긋났소!' },
  { cn: '兵家大忌！', kr: '병법의 큰 금기로다!' },
];

// ==========================================
// 💡 모바일 호환용 시스템 팝업창 (alert/confirm 대체)
// ==========================================
let sysConfirmCallback = null;

function showSysConfirm(msg, onConfirm) {
  document.getElementById('sys-modal-msg').innerText = msg;
  document.getElementById('sys-btn-cancel').style.display = 'block';
  sysConfirmCallback = onConfirm;
  document.getElementById('sys-modal-overlay').style.display = 'flex';
}

function showSysAlert(msg) {
  document.getElementById('sys-modal-msg').innerText = msg;
  document.getElementById('sys-btn-cancel').style.display = 'none';
  sysConfirmCallback = null;
  document.getElementById('sys-modal-overlay').style.display = 'flex';
}

function closeSysModal() {
  document.getElementById('sys-modal-overlay').style.display = 'none';
}

function onSysConfirmClick() {
  closeSysModal();
  if (sysConfirmCallback) sysConfirmCallback();
}

function onSysCancelClick() {
  closeSysModal();
  sysConfirmCallback = null;
}

// ==========================================
// 🎵 오디오 시스템
// ==========================================
let audioCtx = null;
const BGM_DEFAULT_VOL = 0.5;
const BGM_QUIZ_VOL = 0.05;

let lobbyBGM = new Audio('lobby.mp3');
lobbyBGM.loop = true;
lobbyBGM.volume = BGM_DEFAULT_VOL;

const mainBGMFiles = ['main1.mp3', 'main2.mp3'];
let currentMainBGM = null;

function initAudio() {
  if (!audioCtx)
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  window.speechSynthesis.getVoices();
}

function playLobbyBGM() {
  if (currentMainBGM) currentMainBGM.pause();
  lobbyBGM.currentTime = 0;
  lobbyBGM.play().catch((e) => console.log('BGM 자동재생 차단됨'));
}

function playRandomMainBGM() {
  lobbyBGM.pause();
  if (currentMainBGM) currentMainBGM.pause();

  const nextFile =
    mainBGMFiles[Math.floor(Math.random() * mainBGMFiles.length)];
  currentMainBGM = new Audio(nextFile);
  currentMainBGM.volume = BGM_DEFAULT_VOL;
  currentMainBGM.play().catch((e) => console.log('BGM 차단됨'));
  currentMainBGM.onended = playRandomMainBGM;
}

function dimBGM() {
  if (currentMainBGM) currentMainBGM.volume = BGM_QUIZ_VOL;
}
function restoreBGM() {
  if (currentMainBGM) currentMainBGM.volume = BGM_DEFAULT_VOL;
}

function playStoneSound() {
  if (!audioCtx) return;
  const osc = audioCtx.createOscillator();
  const gainNode = audioCtx.createGain();
  osc.connect(gainNode);
  gainNode.connect(audioCtx.destination);
  osc.type = 'sine';
  osc.frequency.setValueAtTime(150, audioCtx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(40, audioCtx.currentTime + 0.1);
  gainNode.gain.setValueAtTime(1, audioCtx.currentTime);
  gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);
  osc.start();
  osc.stop(audioCtx.currentTime + 0.1);
}

function playCorrectSound() {
  if (!audioCtx) return;
  [523.25, 659.25, 783.99].forEach((freq, i) => {
    setTimeout(() => {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.4, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.3);
    }, i * 150);
  });
}

function playWrongSound() {
  if (!audioCtx) return;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(200, audioCtx.currentTime);
  osc.frequency.linearRampToValueAtTime(100, audioCtx.currentTime + 0.3);
  gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);
  osc.start();
  osc.stop(audioCtx.currentTime + 0.3);
}

function getChineseVoices() {
  const voices = window.speechSynthesis.getVoices();
  // 💡 가장 핵심: lang 속성이 'zh'로 시작하는 목소리만 필터링
  const zhVoices = voices.filter((v) => v.lang.startsWith('zh'));

  let female = null,
    male = null;
  if (zhVoices.length > 0) {
    // 이름에 'female' 혹은 중국어 여성 이름이 들어간 것을 우선 탐색
    female = zhVoices.find(
      (v) =>
        v.name.toLowerCase().includes('female') ||
        v.name.includes('Xiaoxiao') ||
        v.name.includes('Tingting') ||
        v.name.includes('Yaoyao') ||
        v.name.includes('Mei-Jia') ||
        v.name.includes('Ting-Ting'),
    );
    male = zhVoices.find(
      (v) =>
        v.name.toLowerCase().includes('male') ||
        v.name.includes('Yunxi') ||
        v.name.includes('Yunjian') ||
        v.name.includes('Kangkang') ||
        v.name.includes('Qiang') ||
        v.name.includes('Han'),
    );

    if (!female) female = zhVoices[0];
    if (!male) male = zhVoices.find((v) => v !== female) || zhVoices[0];
  }
  return { female, male };
}
function playQuestionTTS() {
  if (!window.speechSynthesis || !currentQuizObj) return;
  window.speechSynthesis.cancel();

  let utter = new SpeechSynthesisUtterance(currentQuizObj.cnA);
  // 💡 언어를 강제로 중국어(zh-CN)로 명시
  utter.lang = 'zh-CN';
  utter.rate = 0.8;
  utter.volume = 1.0;

  if (currentQuestionVoice) {
    utter.voice = currentQuestionVoice;
  }
  window.speechSynthesis.speak(utter);
}

function playSingleTTS(text) {
  if (!window.speechSynthesis) return;
  window.speechSynthesis.cancel();

  let utter = new SpeechSynthesisUtterance(text);
  // 💡 언어를 강제로 중국어(zh-CN)로 명시
  utter.lang = 'zh-CN';
  utter.rate = 0.8;
  utter.volume = 1.0;

  if (currentAnswerVoice) {
    utter.voice = currentAnswerVoice;
  }
  window.speechSynthesis.speak(utter);
}

// ==========================================
// 🎮 화면 및 게임 로직
// ==========================================
function showLobby() {
  document.getElementById('splash-screen').style.opacity = '0';
  setTimeout(() => {
    document.getElementById('splash-screen').style.display = 'none';
    document.getElementById('lobby-screen').style.display = 'flex';
    playLobbyBGM();
  }, 500);
}

function prepareGame() {
  initAudio();
  const selectedLessons = document
    .getElementById('lesson-select')
    .value.split(',')
    .map(Number);
  currentLessonPool = allQuizData.filter((item) =>
    selectedLessons.includes(item.lesson),
  );

  if (currentLessonPool.length === 0) {
    showSysAlert('해당 과의 데이터가 아직 없습니다.\n다른 과를 선택해주세요.');
    return;
  }

  document.getElementById('lobby-screen').style.display = 'none';
  document.getElementById('rule-modal-overlay').style.display = 'flex';
  document.getElementById('mode-indicator').innerText =
    `학습 범위: [${selectedLessons[0]}과 ~ ${selectedLessons[1]}과]`;
}

function startGame() {
  document.getElementById('rule-modal-overlay').style.display = 'none';
  const gameScreen = document.getElementById('game-screen');
  gameScreen.style.display = 'flex';
  setTimeout(() => {
    gameScreen.style.opacity = '1';
  }, 50);

  playRandomMainBGM();
  initBoard();
}

function initBoard() {
  const boardElement = document.getElementById('board');
  boardElement.innerHTML = '';
  boardState = Array.from({ length: BOARD_SIZE }, () =>
    Array(BOARD_SIZE).fill(null),
  );

  currentPlayer = 'black';
  gameOver = false;
  reviewLog = [];
  moveHistory = [];
  undoCount = 2;
  updateUndoButton();

  document.getElementById('status').innerText = '흑(Black) 차례입니다';

  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      const cell = document.createElement('div');
      cell.classList.add('cell');
      cell.dataset.row = r;
      cell.dataset.col = c;
      cell.addEventListener('click', onCellClick);
      boardElement.appendChild(cell);
    }
  }
}

function updateUndoButton() {
  const btn = document.getElementById('undo-btn');
  btn.innerText = `↩️ 무르기(${undoCount})`;
  btn.disabled = undoCount <= 0 || gameOver;
}

function undoMove() {
  if (gameOver || undoCount <= 0) return;
  if (moveHistory.length === 0) {
    showSysAlert('무를 수 있는 수가 없습니다.');
    return;
  }

  const lastMove = moveHistory.pop();
  if (lastMove.color !== 'none') {
    boardState[lastMove.r][lastMove.c] = null;
    const targetCell = document.querySelector(
      `.cell[data-row="${lastMove.r}"][data-col="${lastMove.c}"]`,
    );
    const stone = targetCell.querySelector('.stone');
    if (stone) stone.remove();
  }

  if (reviewLog.length > 0) reviewLog.pop();

  currentPlayer = lastMove.prevPlayer;
  undoCount--;
  updateUndoButton();

  const nextText = currentPlayer === 'black' ? '흑(Black)' : '백(White)';
  document.getElementById('status').innerText = `${nextText} 차례입니다`;
}

function restartGame() {
  showSysConfirm(
    '정말 이 판을 다시 시작하시겠습니까?\n(현재까지 푼 문제 기록도 지워집니다)',
    () => {
      initBoard();
    },
  );
}

function returnToLobbyFromGame() {
  showSysConfirm('게임을 중단하고 로비로 돌아가시겠습니까?', () => {
    document.getElementById('game-screen').style.display = 'none';
    document.getElementById('lobby-screen').style.display = 'flex';
    playLobbyBGM();
  });
}

// ==========================================
// 🎮 퀴즈 풀이 로직
// ==========================================
function toggleTranslation() {
  const krElem = document.getElementById('modal-question-kr');
  const cnElem = document.getElementById('modal-question-cn');
  if (krElem.style.display === 'none') {
    krElem.style.display = 'block';
    cnElem.style.display = 'none';
  } else {
    krElem.style.display = 'none';
    cnElem.style.display = 'block';
  }
}

function onCellClick(e) {
  if (gameOver) return;
  const target = e.target.closest('.cell');
  if (!target || target.querySelector('.stone')) return;

  pendingRow = parseInt(target.dataset.row);
  pendingCol = parseInt(target.dataset.col);

  currentQuizObj =
    currentLessonPool[Math.floor(Math.random() * currentLessonPool.length)];
  let wrongObj;
  do {
    wrongObj =
      currentLessonPool[Math.floor(Math.random() * currentLessonPool.length)];
  } while (wrongObj === currentQuizObj && currentLessonPool.length > 1);

  currentChoices = [
    { text: currentQuizObj.cnB, isCorrect: true },
    { text: wrongObj.cnB, isCorrect: false },
  ];
  if (Math.random() > 0.5) currentChoices.reverse();
  correctIndex = currentChoices.findIndex((c) => c.isCorrect);

  const voices = getChineseVoices();
  if (Math.random() < 0.5) {
    currentQuestionVoice = voices.female;
    currentAnswerVoice = voices.male;
  } else {
    currentQuestionVoice = voices.male;
    currentAnswerVoice = voices.female;
  }

  document.getElementById('modal-title').innerText =
    `[듣고 알맞은 대답 고르기]`;
  document.getElementById('modal-question-cn').innerText = currentQuizObj.cnA;
  document.getElementById('modal-question-kr').innerText = currentQuizObj.krA;

  document.getElementById('modal-question-kr').style.display = 'none';
  document.getElementById('modal-question-cn').style.display = 'block';

  const container = document.getElementById('choices-container');
  container.innerHTML = '';
  currentChoices.forEach((choice, idx) => {
    const row = document.createElement('div');
    row.className = 'choice-row';
    const ttsBtn = document.createElement('button');
    ttsBtn.className = 'choice-tts-btn';
    ttsBtn.innerText = '🔊';
    ttsBtn.onclick = () => playSingleTTS(choice.text);

    const selectBtn = document.createElement('button');
    selectBtn.className = 'choice-btn-new';
    selectBtn.innerText = choice.text;
    selectBtn.onclick = () => handleAnswer(idx);

    row.appendChild(ttsBtn);
    row.appendChild(selectBtn);
    container.appendChild(row);
  });

  dimBGM();
  document.getElementById('quiz-modal-overlay').style.display = 'flex';
  playQuestionTTS();
}

let toastTimeoutAnim;
function showToast(isCorrect, cnAnswerText = '', krAnswerText = '') {
  const toast = document.getElementById('board-toast');
  const toastCn = document.getElementById('toast-cn');
  const toastKr = document.getElementById('toast-kr');
  const toastAns = document.getElementById('toast-answer');

  toast.className = '';
  clearTimeout(toastTimeoutAnim);

  const messages = isCorrect ? correctMessages : wrongMessages;
  const msg = messages[Math.floor(Math.random() * messages.length)];

  toastCn.innerText = msg.cn;
  toastKr.innerText = msg.kr;

  if (isCorrect) {
    toast.classList.add('toast-correct');
    toastAns.style.display = 'none';
  } else {
    toast.classList.add('toast-wrong');
    toastAns.style.display = 'block';
    toastAns.innerHTML = `<div style="margin-bottom: 5px;">정답: ${cnAnswerText}</div><div style="font-size: 15px; color: #ddd;">(${krAnswerText})</div>`;
  }

  toast.style.display = 'flex';
  toastTimeoutAnim = setTimeout(() => {
    toast.classList.add('fade-out');
    setTimeout(() => {
      toast.style.display = 'none';
    }, 500);
  }, 1500);
}

function handleAnswer(selectedIdx) {
  window.speechSynthesis.cancel();
  restoreBGM();
  document.getElementById('quiz-modal-overlay').style.display = 'none';

  let placedColor = '';
  const isCorrect = selectedIdx === correctIndex;

  reviewLog.push({
    qCn: currentQuizObj.cnA,
    qKr: currentQuizObj.krA,
    aCn: currentQuizObj.cnB,
    aKr: currentQuizObj.krB,
    isCorrect: isCorrect,
  });

  if (isCorrect) {
    placedColor = currentPlayer;
    playCorrectSound();
    showToast(true);
  } else {
    playWrongSound();
    showToast(false, currentQuizObj.cnB, currentQuizObj.krB);
    placedColor = 'gray';
  }

  placeStone(pendingRow, pendingCol, placedColor);
}

function placeStone(r, c, color) {
  moveHistory.push({ r: r, c: c, color: color, prevPlayer: currentPlayer });

  if (color !== 'none') {
    boardState[r][c] = color;
    const targetCell = document.querySelector(
      `.cell[data-row="${r}"][data-col="${c}"]`,
    );
    const stone = document.createElement('div');
    stone.classList.add('stone', color);
    targetCell.appendChild(stone);

    playStoneSound();

    if (color !== 'gray' && checkWin(r, c, color)) {
      const winnerText = color === 'black' ? '흑(Black)' : '백(White)';
      document.getElementById('status').innerText = `${winnerText} 승리!`;
      gameOver = true;
      updateUndoButton();

      if (currentMainBGM) currentMainBGM.pause();
      setTimeout(showReviewModal, 1500);
      return;
    }
  }

  currentPlayer = currentPlayer === 'black' ? 'white' : 'black';
  const nextText = currentPlayer === 'black' ? '흑(Black)' : '백(White)';
  document.getElementById('status').innerText = `${nextText} 차례입니다`;
}

function checkWin(r, c, color) {
  const dirs = [
    [1, 0],
    [0, 1],
    [1, 1],
    [1, -1],
  ];
  for (let [dr, dc] of dirs) {
    let count = 1;
    let nr = r + dr,
      nc = c + dc;
    while (
      nr >= 0 &&
      nr < BOARD_SIZE &&
      nc >= 0 &&
      nc < BOARD_SIZE &&
      boardState[nr][nc] === color
    ) {
      count++;
      nr += dr;
      nc += dc;
    }
    nr = r - dr;
    nc = c - dc;
    while (
      nr >= 0 &&
      nr < BOARD_SIZE &&
      nc >= 0 &&
      nc < BOARD_SIZE &&
      boardState[nr][nc] === color
    ) {
      count++;
      nr -= dr;
      nc -= dc;
    }
    if (count >= 5) return true;
  }
  return false;
}

// ==========================================
// 📚 복습 노트
// ==========================================
function showReviewModal() {
  const listContainer = document.getElementById('review-list');
  listContainer.innerHTML = '';
  if (reviewLog.length === 0) {
    listContainer.innerHTML = '<p>푼 문제가 없습니다.</p>';
  } else {
    reviewLog.forEach((item, idx) => {
      const div = document.createElement('div');
      div.className = 'review-item';
      const mark = item.isCorrect
        ? '<span class="review-mark correct">[O 맞음]</span>'
        : '<span class="review-mark wrong">[X 틀림]</span>';
      div.innerHTML = `
                <div class="review-q">${idx + 1}. ${mark} ${item.qCn}</div>
                <div class="review-a" style="margin-bottom: 5px;">(${item.qKr})</div>
                <div class="review-q" style="color: #0066cc;">정답: ${item.aCn}</div>
                <div class="review-a">(${item.aKr})</div>
            `;
      listContainer.appendChild(div);
    });
  }
  document.getElementById('review-modal-overlay').style.display = 'flex';
}

function returnToLobby() {
  document.getElementById('review-modal-overlay').style.display = 'none';
  document.getElementById('game-screen').style.display = 'none';
  document.getElementById('lobby-screen').style.display = 'flex';
  playLobbyBGM();
}
