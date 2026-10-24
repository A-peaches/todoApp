// 공주 투두 화면 동작 (princess-todo.html에서 분리)
// 순서: 저장소 → 홈(헤더·이번 주·멘트·달력·날씨·하트) → 할 일 등록 → 완료한 일 → 일기장 → 테마 → 알림 → 프로필 → 화면 전환 → 캐릭터 → 눈
(async function () {
  const pad = n => String(n).padStart(2, '0');
  const iso = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
  const now = new Date(); now.setHours(0, 0, 0, 0);
  const todayIso = iso(now);
  const EN_DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const EN_MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

  let character = 'bunny', drawCharacter = null;   // 픽셀 캐릭터 (테마에서 바꿈)

  // ---- 로컬 DB (db.js) ----
  await PrincessDB.init();
  let todos = await PrincessDB.todos.all();

  // ---- 헤더 ----
  document.getElementById('today').textContent = now.getFullYear() + '. ' + pad(now.getMonth() + 1) + '. ' + pad(now.getDate()) + '.';
  document.getElementById('enDay').textContent = EN_DAYS[now.getDay()] + ', full of joy in my palace';

  // ---- 이번 주 할 일 ----
  const weekEnd = iso(addDays(now, 6));
  // 목록 앞 아이콘: 캐릭터가 토끼면 하트, 클로버면 네잎클로버 (CSS가 하나만 보여줌)
  const heart = '<span class="ico"><svg class="ico-heart" viewBox="0 0 20 18" aria-hidden="true"><path d="M10 17 C2 11 1 6 4 3 C6.5 .8 9 2.4 10 4.5 C11 2.4 13.5 .8 16 3 C19 6 18 11 10 17Z" class="f-heart"/></svg><svg class="ico-clover" viewBox="0 0 20 20" aria-hidden="true"><path class="f-clover" d="M2.6 6.4a3.9 3.9 0 1 0 7.8 0a3.9 3.9 0 1 0 -7.8 0Z M9.6 6.4a3.9 3.9 0 1 0 7.8 0a3.9 3.9 0 1 0 -7.8 0Z M2.6 13.6a3.9 3.9 0 1 0 7.8 0a3.9 3.9 0 1 0 -7.8 0Z M9.6 13.6a3.9 3.9 0 1 0 7.8 0a3.9 3.9 0 1 0 -7.8 0Z"/></svg></span>';
  const esc = s => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  // 토스트 (버튼 하나 선택)
  const toast = document.getElementById('toast');
  let tt;
  function showToast(html, actionLabel, onAction) {
    toast.innerHTML = '<span>' + html + '</span>' + (actionLabel ? '<button type="button">' + actionLabel + '</button>' : '');
    if (actionLabel) toast.querySelector('button').onclick = () => { toast.hidden = true; onAction(); };
    toast.hidden = false; clearTimeout(tt); tt = setTimeout(() => { toast.hidden = true; }, actionLabel ? 3500 : 1800);
  }

  const weekList = document.getElementById('weekList');
  function renderWeek() {
    const week = todos.filter(t => !t.done && t.date >= todayIso && t.date <= weekEnd).sort((a, b) => a.date.localeCompare(b.date));
    weekList.innerHTML = week.length ? week.map(t => {
      const [, m, d] = t.date.split('-');
      const isToday = t.date === todayIso;
      return '<li class="' + (isToday ? 'today' : '') + '" data-id="' + t.id + '" role="button" tabindex="0" aria-label="' + esc(t.title) + ' 완료하기">' +
        heart + '<span class="t" title="' + esc(t.title) + '">' + esc(t.title) + '</span><span class="d">' + (isToday ? '오늘' : m + '.' + d) + '</span></li>';
    }).join('') : '<li class="empty">한동안 여유롭게 ・₊✧</li>';
  }

  // 할 일 누르면 완료 처리 (토스트에서 되돌리기 가능)
  async function setDone(id, done) {
    await PrincessDB.todos.setDone(id, done);
    todos = await PrincessDB.todos.all();
    renderWeek(); renderCal();
  }
  function complete(li) {
    if (li.classList.contains('checked')) return;
    const id = li.dataset.id, title = li.querySelector('.t').textContent;
    li.classList.add('checked');
    setTimeout(() => li.classList.add('leaving'), 250);
    setTimeout(() => {
      setDone(id, true);
      showToast(esc(title) + ' 완료! ・₊✧', '되돌리기', () => setDone(id, false));
    }, 600);
  }
  weekList.addEventListener('click', e => { const li = e.target.closest('li[data-id]'); if (li) complete(li); });
  weekList.addEventListener('keydown', e => {
    const li = e.target.closest('li[data-id]');
    if (li && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); complete(li); }
  });
  renderWeek();

  // ---- 매일 바뀌는 멘트 ----
  // 앱이 사용자에게 직접 말을 거는 해요체 멘트. 앞에 'OOO님,'이 붙어요.
  const cheers = [
    // 기본 응원
    '오늘도 반짝반짝 빛날 거예요!', '천천히 가도 괜찮아요, 잘하고 있어요', '오늘도 스스로에게 박수 쳐 줘요',
    '작은 체크 하나도 정말 대단한 거예요', '따뜻한 차 한 잔 하고 힘내요', '오늘 하루의 주인공은 당신이에요',
    '피곤하면 쉬어도 돼요, 내일도 있으니까요', '하나씩 지워 가는 재미를 느껴 봐요', '웃는 얼굴이 제일 예뻐요',
    '오늘도 무사히, 그거면 충분해요', '어제보다 딱 한 걸음만 더 가 봐요', '잘 먹고 잘 자는 것도 중요한 일이에요',
    '쉽게 포기하지 않는 모습이 멋져요', '오늘 한 일, 꼭 스스로 칭찬해 줘요', '마음이 바쁠수록 숨 한 번 크게 쉬어요',
    '노력은 눈처럼 조용히 쌓이고 있어요', '오늘의 운세는 무조건 좋음이에요', '이미 충분히 잘 해내고 있어요',
    '반짝이는 하루가 될 거예요', '좋아하는 노래 한 곡 듣고 시작해요', '오늘도 수고 많았어요',
    // 시작하는 마음
    '시작이 반이니까 벌써 반 왔어요', '첫 번째 할 일만 끝내면 술술 풀릴 거예요', '오늘은 오늘 몫만 하면 돼요',
    '완벽보다 완료! 일단 해 봐요', '딱 5분만 해 보고 다시 생각해요', '어려운 건 아침에, 쉬운 건 오후에 해 봐요',
    '오늘은 딱 하나만 제대로 해 봐요', '하고 싶은 일도 하나 꼭 넣어 줘요', '미루던 일 하나, 오늘 해치워 봐요',
    '작게 시작해도 크게 끝날 수 있어요', '할 수 있다고 믿으면 반은 성공이에요', '준비 완료! 이제 출발해 볼까요',
    // 아끼는 말
    '물 한 잔 마셨어요? 지금 마셔요', '어깨 한 번 쭉 펴 볼까요', '거울 속 자신에게 윙크 한 번 해 줘요',
    '스스로에게 제일 다정한 사람이 되어 줘요', '쉬는 것도 실력이에요', '배고프면 아무것도 안 돼요, 맛있는 거 먹어요',
    '오늘은 일찍 자기로 약속해요', '스트레칭 한 번이면 기분이 달라져요', '햇빛 5분 쬐기, 오늘의 숙제예요',
    '자신을 위한 작은 선물 하나 어때요', '좋아하는 향기 맡으며 쉬어 가요', '눈 감고 깊게 세 번 숨 쉬어 봐요',
    '힘들면 힘들다고 말해도 괜찮아요', '오늘 어떤 기분이든 다 괜찮아요', '지금 그대로도 충분히 소중해요',
    // 칭찬
    '어제도 정말 수고 많았어요', '지금까지 온 것만으로도 대단해요', '이렇게 꾸준한 사람 흔치 않아요',
    '그 성실함에 궁전이 감동했어요', '생각보다 훨씬 잘하고 있어요', '포기하지 않는 모습, 정말 멋져요',
    '오늘도 일어났으니 이미 1승이에요', '계획을 세운 것부터 대단해요', '조금씩 자라고 있는 게 보여요',
    '자신을 제일 잘 아는 건 바로 당신이에요', '실수해도 괜찮아요, 배우는 중이니까요', '어제보다 오늘 더 빛나요',
    // 공주 & 궁전
    '왕관은 쓰는 사람이 빛내는 거예요', '궁전의 하루가 시작됐어요', '오늘도 우아하게, 하지만 당당하게요',
    '오늘 일정표에 행복 한 칸 추가해 둘게요', '궁전의 평화는 당신 컨디션에 달렸어요', '드레스 대신 용기를 입고 출발해요',
    '오늘의 미션은 즐겁게 하기예요', '눈의 궁전에서도 마음은 따뜻하게요', '쉬는 날에도 당신은 여전히 공주님이에요',
    '토끼가 깡총깡총 응원하고 있어요', '마법 같은 하루가 기다리고 있어요', '반짝이는 건 왕관이 아니라 당신이에요',
    // 작은 행복
    '오늘 맛있는 거 하나는 꼭 먹어요', '좋은 일이 생길 것 같은 예감이 들어요', '하늘 한 번 올려다봐요, 예쁠 거예요',
    '오늘 웃을 일 세 개만 찾아봐요', '좋아하는 사람에게 안부 한 줄 보내 봐요', '작은 행복이 모여 큰 하루가 돼요',
    '오늘 고마운 일 하나 떠올려 봐요', '귀여운 걸 보면 기분이 좋아질 거예요', '오늘의 BGM은 신나는 노래로 골라요',
    '10분만 산책해도 생각이 맑아져요', '달콤한 간식은 오늘의 보상이에요', '방 한 구석 정리하면 마음도 정리돼요',
    // 힘든 날
    '오늘이 힘들면 내일은 조금 나을 거예요', '울어도 괜찮아요, 그다음에 웃으면 돼요', '비 온 뒤에 땅이 굳어요',
    '지금 힘든 건 잘하고 싶어서예요', '천천히 가도 결국 도착해요', '오늘은 버티기만 해도 충분해요',
    '모든 걸 다 잘할 필요는 없어요', '한 번에 하나씩, 그거면 돼요', '쉬어 가도 길은 사라지지 않아요',
    '잘 안 되는 날도 있는 거예요', '내일의 자신에게 조금 맡겨도 돼요', '마음이 무거우면 할 일 하나만 줄여요',
    // 공부 & 일
    '오늘 공부한 건 미래를 위한 선물이에요', '집중 25분, 휴식 5분 해 볼까요', '어려운 문제도 결국 풀려요',
    '오늘 배운 거 하나만 기억해도 성공이에요', '마감 전에 끝내는 짜릿함을 느껴 봐요', '꾸준함은 재능을 이겨요',
    '모르는 건 부끄러운 게 아니에요', '노트 한 장이 쌓여 책이 돼요', '오늘의 노력은 배신하지 않아요',
    '휴대폰 잠깐 내려놓고 집중해 봐요', '목표에 한 칸 더 가까워졌어요', '일 끝난 뒤의 시간을 기대하며 힘내요',
    // 마무리
    '오늘 다 못 끝내도 괜찮아요', '하루 끝에 자신을 꼭 안아 줘요', '잘 자는 것도 내일을 위한 준비예요',
    '오늘 제일 잘한 일 하나 떠올려 봐요', '체크 표시가 늘수록 뿌듯해질 거예요', '오늘도 나답게 살았다면 그걸로 충분해요',
    '내일은 또 내일의 반짝임이 있어요', '따뜻한 샤워로 오늘을 마무리해요', '오늘의 마지막 할 일은 푹 쉬기예요',
    '하루를 무사히 보낸 당신, 최고예요', '별처럼 조용히 빛난 하루였어요', '푹 자고 내일 또 만나요'
  ];
  // 날짜마다 다른 멘트: 37은 개수와 서로소라 120일 동안 겹치지 않고, 연속된 날도 분위기가 섞여요
  const dayNo = Math.floor(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) / 86400000);
  const step = [37, 41, 43, 47, 53].find(s => cheers.length % s !== 0 && gcd(s, cheers.length) === 1) || 1;
  function gcd(a, b) { return b ? gcd(b, a % b) : a; }

  // 특별한 날 (우선순위: 생일 > 기념일 > 일반 멘트). 설날·추석은 음력이라 날짜표로 관리 (2030년까지)
  const SEOLLAL = ['2026-02-17', '2027-02-07', '2028-01-27', '2029-02-13', '2030-02-03'];
  const CHUSEOK = ['2026-09-25', '2027-09-15', '2028-10-03', '2029-09-22', '2030-09-12'];
  const HOLIDAY_MD = {
    '01-01': '새해 복 많이 받아요! 올해도 반짝이는 날만 가득하길',
    '12-24': '내일은 크리스마스예요! 설레는 밤 보내요',
    '12-25': '메리 크리스마스! 따뜻하고 반짝이는 하루 보내요',
    '12-31': '올 한 해도 정말 수고 많았어요'
  };
  function isBirthday(birth) {
    if (!birth) return false;
    const md = birth.slice(5), leap = new Date(now.getFullYear(), 1, 29).getMonth() === 1;
    return todayIso.slice(5) === (md === '02-29' && !leap ? '02-28' : md);
  }
  function todayNote() {
    if (profile && isBirthday(profile.birth)) return '생일 축하해요! 태어나 줘서 정말 고마워요 ✧';
    if (SEOLLAL.includes(todayIso)) return '즐거운 설날이에요! 새해 복 많이 받아요';
    if (CHUSEOK.includes(todayIso)) return '풍성한 한가위 보내요! 맛있는 거 많이 먹어요';
    if (HOLIDAY_MD[todayIso.slice(5)]) return HOLIDAY_MD[todayIso.slice(5)];
    return cheers[(dayNo * step) % cheers.length];
  }
  function renderCheer() {
    const el = document.getElementById('cheer');
    el.textContent = '';
    if (profile && profile.name) {
      const who = document.createElement('span');
      who.className = 'cheer-name';
      who.textContent = profile.name + '님,';
      el.append(who, document.createElement('br'));
    }
    el.append(todayNote());
  }
  let profile = await PrincessDB.profile.get();
  renderCheer();

  // ---- 2주 달력 (FullCalendar) ----
  // 오늘 요일을 한 주의 시작으로 잡아서 오늘부터 2주를 보여줘요
  const WK = ['일', '월', '화', '수', '목', '금', '토'];
  let calendar;
  function renderCal() {
    const counts = {};
    todos.forEach(t => { counts[t.date] = (counts[t.date] || 0) + 1; });
    const months = [];
    for (let i = 0; i < 14; i++) { const m = addDays(now, i).getMonth(); if (!months.includes(m)) months.push(m); }
    document.getElementById('monthLabel').textContent = months.map(m => EN_MONTHS[m]).join(' · ');

    if (calendar) calendar.destroy();
    calendar = new FullCalendar.Calendar(document.getElementById('calendar'), {
      initialView: 'twoWeeks',
      views: { twoWeeks: { type: 'dayGrid', duration: { weeks: 2 } } },
      initialDate: now,
      firstDay: now.getDay(),
      headerToolbar: false,
      height: 'auto',
      dayHeaderContent: arg => WK[arg.date.getDay()],
      dayHeaderClassNames: arg => arg.date.getDay() === 0 ? ['sun'] : arg.date.getDay() === 6 ? ['sat'] : [],
      dayCellClassNames: arg => {
        const k = iso(arg.date);
        return [k === todayIso ? 'today' : '', k !== todayIso && arg.date.getDate() === 1 ? 'first' : ''].filter(Boolean);
      },
      dayCellContent: arg => {
        const c = counts[iso(arg.date)] || 0;
        return { html: '<span class="n">' + arg.date.getDate() + '</span><span class="c' + (c ? ' has' : '') + '">' + (c || '·') + '</span>' };
      },
      dayCellDidMount: arg => {
        const c = counts[iso(arg.date)] || 0;
        arg.el.setAttribute('aria-label', (arg.date.getMonth() + 1) + '월 ' + arg.date.getDate() + '일, 할 일 ' + c + '개, 누르면 할 일 등록으로');
        // 날짜를 누르면 그 날짜를 고른 채로 할 일 등록 화면으로
        const k = iso(arg.date), go = () => openAddFor(k);
        arg.el.tabIndex = 0;
        arg.el.setAttribute('role', 'button');
        arg.el.addEventListener('click', go);
        arg.el.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } });
      }
    });
    calendar.render();
  }
  renderCal();

  // ---- 날씨 (사용자 위치 → Open-Meteo, 무료·키 없음) ----
  const WX_ICON = {
    sun: '<svg viewBox="0 0 46 40"><g stroke="#d2ab52" stroke-width="2.2" stroke-linecap="round"><path d="M23 3v5M23 32v5M6 20h5M35 20h5M11 8l3.5 3.5M31.5 28.5L35 32M35 8l-3.5 3.5M14.5 28.5L11 32"/></g><circle cx="23" cy="20" r="8" fill="#fbecc0" stroke="#d2ab52" stroke-width="2"/></svg>',
    partly: '<svg viewBox="0 0 46 40"><g stroke="#d2ab52" stroke-width="2" stroke-linecap="round"><path d="M17 3v4M5 15h4M8.5 6.5l2.8 2.8M25.5 6.5l-2.8 2.8"/></g><circle cx="17" cy="15" r="6.5" fill="#fbecc0" stroke="#d2ab52" stroke-width="2"/><path d="M14 35 C8 35 7 27 13 26 C13 19 22 17 25.5 22 C29 17 39 19 37.5 27 C43 28 42 35 36 35Z" fill="#fff" stroke="#9fb3e0" stroke-width="2"/></svg>',
    cloud: '<svg viewBox="0 0 46 40"><path d="M12 32 C5 32 4 23 11 22 C11 14 21 11 25 17 C29 11 40 14 38 23 C44 24 43 32 36 32Z" fill="#fff" stroke="#9fb3e0" stroke-width="2"/></svg>',
    rain: '<svg viewBox="0 0 46 40"><path d="M12 26 C5 26 4 17 11 16 C11 8 21 5 25 11 C29 5 40 8 38 17 C44 18 43 26 36 26Z" fill="#fff" stroke="#9fb3e0" stroke-width="2"/><g stroke="#6f8cc4" stroke-width="2" stroke-linecap="round"><path d="M15 30l-2 5M23 30l-2 5M31 30l-2 5"/></g></svg>',
    snow: '<svg viewBox="0 0 46 40"><path d="M12 26 C5 26 4 17 11 16 C11 8 21 5 25 11 C29 5 40 8 38 17 C44 18 43 26 36 26Z" fill="#fff" stroke="#9fb3e0" stroke-width="2"/><g fill="#9fb3e0"><circle cx="15" cy="32" r="1.8"/><circle cx="23" cy="35" r="1.8"/><circle cx="31" cy="32" r="1.8"/></g></svg>',
    storm: '<svg viewBox="0 0 46 40"><path d="M12 26 C5 26 4 17 11 16 C11 8 21 5 25 11 C29 5 40 8 38 17 C44 18 43 26 36 26Z" fill="#fff" stroke="#9fb3e0" stroke-width="2"/><path d="M24 26l-5 7h5l-3 6 8-9h-5l3-4z" fill="#f1dc9e" stroke="#bf9a48" stroke-width="1"/></svg>'
  };
  const WX_LABEL = { sun: '맑음', partly: '구름 조금', cloud: '흐림', rain: '비', snow: '눈', storm: '천둥번개' };
  // WMO 날씨 코드 → 아이콘 종류
  const wxKind = TodoNotify.wxKind;   // notify.js (알림 문구와 같은 기준)

  function paintWeather(w) {
    [0, 1].forEach(i => {
      const card = document.getElementById('wx' + i), kind = wxKind(w.code[i]);
      card.querySelector('.wx-ico').innerHTML = WX_ICON[kind];
      card.querySelector('.lo').textContent = Math.round(w.min[i]) + '°';
      card.querySelector('.hi').textContent = Math.round(w.max[i]) + '°';
      card.querySelector('.wx-label').textContent = WX_LABEL[kind];
    });
  }
  function weatherMessage(msg) {
    [0, 1].forEach(i => {
      const card = document.getElementById('wx' + i);
      card.querySelector('.wx-ico').innerHTML = WX_ICON.cloud;
      card.querySelector('.wx-label').textContent = msg;
    });
  }
  // 사용자 위치. 위치 권한이 없거나 막히면 서울 기준으로 (날씨가 비어 보이지 않게)
  const SEOUL = { coords: { latitude: 37.5665, longitude: 126.978 }, fallback: true };
  const getPosition = () => new Promise(ok => {
    if (!navigator.geolocation) { ok(SEOUL); return; }
    navigator.geolocation.getCurrentPosition(ok, () => ok(SEOUL), { timeout: 10000, maximumAge: 30 * 60 * 1000 });
  });
  // 오늘·내일 날씨 받기: 기온, 날씨 코드, 강수확률, 평균 습도 (알림 멘트에도 씀)
  async function fetchWeather() {
    const { latitude, longitude } = (await getPosition()).coords;
    const url = 'https://api.open-meteo.com/v1/forecast?latitude=' + latitude.toFixed(3) + '&longitude=' + longitude.toFixed(3) +
      '&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,relative_humidity_2m_mean&timezone=auto&forecast_days=2';
    const d = (await (await fetch(url)).json()).daily;
    const w = { date: iso(new Date()), code: d.weather_code, max: d.temperature_2m_max, min: d.temperature_2m_min,
      rain: d.precipitation_probability_max, hum: d.relative_humidity_2m_mean };
    await PrincessDB.cache.set('weather', w);
    return w;
  }
  async function loadWeather() {
    const cached = await PrincessDB.cache.get('weather');
    const usable = cached && cached.value.date === todayIso;
    if (usable) paintWeather(cached.value);
    if (usable && cached.value.hum && Date.now() - cached.savedAt < 60 * 60 * 1000) return;   // 1시간 안에 받은 건 그대로 사용
    try { paintWeather(await fetchWeather()); }
    catch (e) { if (!usable) weatherMessage('날씨를 못 불러왔어요'); }
  }
  loadWeather();
  // 날씨 카드를 누르면 구글 날씨 검색 (설치한 앱에서는 브라우저로 열림)
  document.querySelectorAll('.weather[data-q]').forEach(card => {
    const open = () => window.open('https://www.google.com/search?q=' + encodeURIComponent(card.dataset.q), '_blank', 'noopener');
    card.addEventListener('click', open);
    card.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } });
  });

  // ---- 하트 / 탭바 ----
  const bh = document.getElementById('bigHeart');
  // 하트 누른 횟수: DB에 날짜별로 한 줄씩 저장 → 다시 접속해도 유지, 날이 바뀌면 새 줄(0부터)
  const heartCount = document.getElementById('heartCount');
  function showHearts(n) { heartCount.textContent = n; bh.setAttribute('aria-label', (character === 'clover' ? '클로버' : '하트') + ' 누르기, 오늘 ' + n + '번'); }
  showHearts(await PrincessDB.hearts.get(todayIso));
  // 뿅 소리: 파일 없이 Web Audio로 짧게 음이 올라가는 소리 (누를 때마다 음높이가 조금씩 달라요)
  let audioCtx;
  function boing() {
    try {
      audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
      if (audioCtx.state === 'suspended') audioCtx.resume();
      const t = audioCtx.currentTime, base = 520 + Math.random() * 160;
      const osc = audioCtx.createOscillator(), gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(base, t);
      osc.frequency.exponentialRampToValueAtTime(base * 2.3, t + 0.09);
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.28, t + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.17);
      osc.connect(gain).connect(audioCtx.destination);
      osc.start(t); osc.stop(t + 0.19);
    } catch (e) {}
  }
  bh.addEventListener('click', async () => {
    boing();
    bh.classList.remove('pop'); void bh.offsetWidth; bh.classList.add('pop');
    showHearts(await PrincessDB.hearts.add(iso(new Date())));
  });

  // ---- 할 일 등록 화면 ----
  const KR_DAYS = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'];
  const fromIso = k => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d); };
  const krDate = k => { const d = fromIso(k); return (d.getMonth() + 1) + '월 ' + d.getDate() + '일 ' + KR_DAYS[d.getDay()]; };
  let selected = todayIso;
  let monthCal;

  // 데이터가 바뀌면 두 화면 모두 다시 그림
  async function refreshAll() {
    todos = await PrincessDB.todos.all();
    renderWeek(); renderCal(); renderMonth(); renderDay(); renderDone();
  }

  function markSelected() {
    document.querySelectorAll('#monthCal td.fc-daygrid-day').forEach(td => {
      const on = td.dataset.date === selected;
      td.classList.toggle('sel', on);
      td.setAttribute('aria-pressed', on);
    });
  }
  function selectDate(k) { selected = k; markSelected(); renderDay(); }
  // 홈 2주 달력에서 날짜를 누르면: 그 날짜 선택 + 그 달 보이게 + 할 일 등록 화면으로
  function openAddFor(k) {
    selected = k;
    if (monthCal) monthCal.gotoDate(fromIso(k));
    location.hash = 'add';
  }

  function renderMonth() {
    const counts = {};
    todos.forEach(t => { counts[t.date] = (counts[t.date] || 0) + 1; });
    const shown = monthCal ? monthCal.getDate() : fromIso(selected);
    if (monthCal) monthCal.destroy();
    monthCal = new FullCalendar.Calendar(document.getElementById('monthCal'), {
      initialView: 'dayGridMonth',
      initialDate: shown,
      firstDay: 0,
      fixedWeekCount: false,
      headerToolbar: false,
      height: 'auto',
      dayHeaderContent: arg => WK[arg.date.getDay()],
      dayHeaderClassNames: arg => arg.date.getDay() === 0 ? ['sun'] : arg.date.getDay() === 6 ? ['sat'] : [],
      dayCellClassNames: arg => iso(arg.date) === todayIso ? ['today'] : [],
      dayCellContent: arg => {
        const c = counts[iso(arg.date)] || 0;
        return { html: '<span class="n">' + arg.date.getDate() + '</span><span class="c' + (c ? ' has' : '') + '">' + (c || '·') + '</span>' };
      },
      dayCellDidMount: arg => {
        const k = iso(arg.date), td = arg.el;
        td.tabIndex = 0;
        td.setAttribute('role', 'button');
        td.setAttribute('aria-label', krDate(k) + ', 할 일 ' + (counts[k] || 0) + '개');
        td.addEventListener('click', () => selectDate(k));
        td.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); selectDate(k); } });
      },
      datesSet: () => {
        const d = monthCal ? monthCal.getDate() : shown;
        document.getElementById('monthTitle').textContent = EN_MONTHS[d.getMonth()] + ' ' + d.getFullYear();
        markSelected();
      }
    });
    monthCal.render();
    markSelected();
  }
  document.getElementById('prevMonth').addEventListener('click', () => monthCal.prev());
  document.getElementById('nextMonth').addEventListener('click', () => monthCal.next());

  // 선택한 날짜의 할 일 목록 (하트 = 완료 토글, 연필 = 수정, × = 삭제)
  const PENCIL = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10.5 2.5l3 3L6 13H3v-3z"/><path d="M9 4l3 3"/></svg>';
  const dayList = document.getElementById('dayList');
  function renderDay() {
    document.getElementById('selDate').textContent = krDate(selected) + (selected === todayIso ? ' · 오늘' : '');
    const list = todos.filter(t => t.date === selected).sort((a, b) => (a.done - b.done) || a.createdAt.localeCompare(b.createdAt));
    dayList.innerHTML = list.length ? list.map(t =>
      '<li class="' + (t.done ? 'done' : '') + '" data-id="' + t.id + '">' +
        '<button type="button" class="chk" aria-label="' + esc(t.title) + (t.done ? ' 완료 취소' : ' 완료하기') + '">' + heart + '</button>' +
        '<span class="t">' + esc(t.title) + (t.seriesId ? '<span class="rep" title="반복">↻ ' + (t.repeat === 'weekly' ? '매주' : '매달') + '</span>' : '') + '</span>' +
        '<button type="button" class="edit" aria-label="' + esc(t.title) + ' 수정">' + PENCIL + '</button>' +
        '<button type="button" class="del" aria-label="' + esc(t.title) + ' 삭제">×</button></li>'
    ).join('') : '<li class="day-empty">이 날은 아직 비어 있어요 ・₊✧</li>';
  }
  dayList.addEventListener('click', async e => {
    const li = e.target.closest('li[data-id]');
    if (!li) return;
    const t = todos.find(x => x.id === li.dataset.id);
    if (e.target.closest('.chk')) {
      await PrincessDB.todos.setDone(t.id, !t.done);
      refreshAll();
    } else if (e.target.closest('.edit')) {
      openTodoDialog(t);
    } else if (e.target.closest('.del')) {
      const later = t.seriesId ? todos.filter(x => x.seriesId === t.seriesId && x.date > t.date) : [];
      if (later.length) askDeleteSeries(t, later);
      else deleteTodos([t]);
    }
  });
  async function deleteTodos(list) {
    await PrincessDB.todos.removeMany(list.map(x => x.id));
    await refreshAll();
    showToast(esc(list[0].title) + (list.length > 1 ? ' 외 ' + (list.length - 1) + '개' : '') + ' 삭제했어요', '되돌리기',
      async () => { await PrincessDB.todos.restoreMany(list); refreshAll(); });
  }
  // 반복 할 일 × : 이것만 / 이후 것도 모두
  const delDlg = document.getElementById('delDialog');
  let delTarget = null;
  function askDeleteSeries(t, later) {
    delTarget = { t, later };
    document.getElementById('delText').textContent = '반복되는 할 일이에요. 이후 ' + later.length + '개도 같이 삭제할까요?';
    delDlg.showModal();
  }
  document.getElementById('delOne').addEventListener('click', () => { delDlg.close(); deleteTodos([delTarget.t]); });
  document.getElementById('delAfter').addEventListener('click', () => { delDlg.close(); deleteTodos([delTarget.t, ...delTarget.later]); });
  document.getElementById('delCancel').addEventListener('click', () => delDlg.close());
  delDlg.addEventListener('click', e => { if (e.target === delDlg) delDlg.close(); });

  // ---- 할 일 추가/수정 팝업 ----
  // 추가: 내용 + 반복(안 함/매주/매달 + 끝나는 날) / 수정: 내용 + 날짜 (+ 반복이면 이것만/이후 모두)
  const dlg = document.getElementById('addDialog'), input = document.getElementById('todoInput'), okBtn = document.getElementById('dlgOk');
  const editDate = document.getElementById('editDate'), repeatEnd = document.getElementById('repeatEnd');
  let editing = null, repeat = 'none', scope = 'one';
  const segPick = (attr, value) => document.querySelectorAll('#addDialog [data-' + attr + ']').forEach(b => b.setAttribute('aria-checked', b.dataset[attr] === value));
  const addMonths = (k, n) => { const d = fromIso(k), last = new Date(d.getFullYear(), d.getMonth() + n + 1, 0).getDate(); return iso(new Date(d.getFullYear(), d.getMonth() + n, Math.min(d.getDate(), last))); };

  // 반복 날짜 만들기: 매주 +7일 / 매달 같은 날(없는 달은 그 달 마지막 날), 끝나는 날까지 (최대 400개)
  function seriesDates(start, rep, end) {
    const s = fromIso(start), e = fromIso(end), day = s.getDate(), out = [];
    for (let i = 0; out.length < 400; i++) {
      const d = rep === 'weekly' ? addDays(s, 7 * i)
        : new Date(s.getFullYear(), s.getMonth() + i, Math.min(day, new Date(s.getFullYear(), s.getMonth() + i + 1, 0).getDate()));
      if (d > e) break;
      out.push(iso(d));
    }
    return out;
  }
  function updateRepeatUI() {
    segPick('repeat', repeat);
    document.getElementById('repeatEndRow').hidden = repeat === 'none';
    const n = repeat !== 'none' && repeatEnd.value >= selected ? seriesDates(selected, repeat, repeatEnd.value).length : 0;
    document.getElementById('repeatHint').textContent = repeat === 'none' ? '' :
      (repeat === 'weekly' ? '매주 ' + KR_DAYS[fromIso(selected).getDay()] : '매달 ' + fromIso(selected).getDate() + '일 (없는 달은 마지막 날)') + ' · 총 ' + n + '개';
    checkOk();
  }
  function checkOk() {
    okBtn.disabled = !input.value.trim() || (editing ? !editDate.value : repeat !== 'none' && !(repeatEnd.value > selected));
  }
  function openTodoDialog(t) {
    editing = t || null;
    repeat = 'none'; scope = 'one';
    document.getElementById('dlgTitle').textContent = editing ? 'Edit To-Do' : 'New To-Do';
    document.getElementById('dlgDate').textContent = editing ? '내용과 날짜를 바꿀 수 있어요' : krDate(selected) + '에 추가해요';
    input.value = editing ? editing.title : '';
    document.getElementById('editDateRow').hidden = !editing;
    document.getElementById('repeatRow').hidden = !!editing;
    document.getElementById('scopeRow').hidden = !(editing && editing.seriesId);
    segPick('scope', scope);
    if (editing) editDate.value = editing.date;
    else {
      repeatEnd.min = iso(addDays(fromIso(selected), 1));
      repeatEnd.max = iso(addDays(fromIso(selected), 365 * 3));
      repeatEnd.value = addMonths(selected, 3);   // 기본: 3달 뒤
      updateRepeatUI();
    }
    checkOk();
    dlg.showModal(); input.focus();
  }
  document.getElementById('addBtn').addEventListener('click', () => openTodoDialog(null));
  document.querySelectorAll('#addDialog [data-repeat]').forEach(b => b.addEventListener('click', () => { repeat = b.dataset.repeat; updateRepeatUI(); }));
  document.querySelectorAll('#addDialog [data-scope]').forEach(b => b.addEventListener('click', () => { scope = b.dataset.scope; segPick('scope', scope); }));
  input.addEventListener('input', checkOk);
  editDate.addEventListener('change', checkOk);
  repeatEnd.addEventListener('change', updateRepeatUI);
  repeatEnd.addEventListener('input', updateRepeatUI);
  document.getElementById('dlgCancel').addEventListener('click', () => dlg.close());
  dlg.addEventListener('click', e => { if (e.target === dlg) dlg.close(); });   // 바깥 누르면 닫기
  document.getElementById('addForm').addEventListener('submit', async e => {
    e.preventDefault();
    const title = input.value.trim();
    if (okBtn.disabled || !title) return;
    if (editing) {
      // 날짜는 이 할 일만, 내용은 '이후 반복도 모두'를 고르면 같은 반복의 이후 것까지
      const targets = editing.seriesId && scope === 'after'
        ? todos.filter(x => x.seriesId === editing.seriesId && x.date >= editing.date) : [editing];
      for (const x of targets) await PrincessDB.todos.update(x.id, x.id === editing.id ? { title, date: editDate.value } : { title });
      dlg.close();
      await refreshAll();
      showToast(targets.length > 1 ? '이후 반복 ' + targets.length + '개를 수정했어요' : '수정했어요 ・₊✧');
      return;
    }
    if (repeat === 'none') {
      await PrincessDB.todos.add(title, selected);
      dlg.close();
      await refreshAll();
      showToast(esc(title) + ' 추가했어요 ・₊✧');
    } else {
      const dates = seriesDates(selected, repeat, repeatEnd.value);
      await PrincessDB.todos.addSeries(title, dates, repeat);
      dlg.close();
      await refreshAll();
      showToast(esc(title) + ' ' + (repeat === 'weekly' ? '매주' : '매달') + ' ' + dates.length + '개 추가했어요');
    }
  });

  // ---- 완료한 일 화면: 달마다 완료한 시간 순서대로 한 줄씩 ----
  let doneMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  function renderDone() {
    const y = doneMonth.getFullYear(), m = doneMonth.getMonth();
    document.getElementById('doneMonth').textContent = EN_MONTHS[m] + ' ' + y;
    const list = todos.filter(t => t.done)
      .map(t => ({ t, at: t.doneAt ? new Date(t.doneAt) : fromIso(t.date) }))
      .filter(x => x.at.getFullYear() === y && x.at.getMonth() === m)
      .sort((a, b) => a.at - b.at);
    document.getElementById('doneTotal').textContent = list.length ? (m + 1) + '월에 ' + list.length + '개 완료했어요' : '';
    document.getElementById('doneList').innerHTML = list.length ? list.map(({ t, at }) =>
      '<li><span class="when">' + pad(at.getMonth() + 1) + '.' + pad(at.getDate()) + ' ' + pad(at.getHours()) + ':' + pad(at.getMinutes()) + '</span>' +
      '<span class="t" title="' + esc(t.title) + '">' + esc(t.title) + '</span></li>'
    ).join('') : '<li class="done-empty">이 달은 아직 완료한 일이 없어요 ・₊✧</li>';
  }
  document.getElementById('donePrev').addEventListener('click', () => { doneMonth = new Date(doneMonth.getFullYear(), doneMonth.getMonth() - 1, 1); renderDone(); });
  document.getElementById('doneNext').addEventListener('click', () => { doneMonth = new Date(doneMonth.getFullYear(), doneMonth.getMonth() + 1, 1); renderDone(); });

  // ---- 일기장: 주 단위 달력 + 하루 한 장 일기 ----
  // 상태: 비어 있음(입력 + 가운데 + 로 저장) / 보기(왼쪽 아래 '수정') / 수정 중(같은 버튼이 '저장')
  let diaryDay = todayIso, diaryEditing = false, diarySaved = '', weekCal;
  const diaryText = document.getElementById('diaryText'), diaryEdit = document.getElementById('diaryEdit'),
    diarySave = document.getElementById('diarySave'), diaryNote = document.getElementById('diaryNote');
  const diaryDirty = () => diaryEditing && diaryText.value !== diarySaved;

  async function renderWeekCal() {
    const written = new Set(await PrincessDB.diaries.dates());
    const shown = weekCal ? weekCal.getDate() : fromIso(diaryDay);
    if (weekCal) weekCal.destroy();
    weekCal = new FullCalendar.Calendar(document.getElementById('weekCal'), {
      initialView: 'dayGridWeek',
      initialDate: shown,
      firstDay: 0,
      headerToolbar: false,
      height: 'auto',
      dayHeaderContent: arg => WK[arg.date.getDay()],
      dayHeaderClassNames: arg => arg.date.getDay() === 0 ? ['sun'] : arg.date.getDay() === 6 ? ['sat'] : [],
      dayCellClassNames: arg => iso(arg.date) === todayIso ? ['today'] : [],
      dayCellContent: arg => {
        const has = written.has(iso(arg.date));
        return { html: '<span class="n">' + arg.date.getDate() + '</span><span class="c' + (has ? ' has' : '') + '">' + (has ? '' : '·') + '</span>' };
      },
      dayCellDidMount: arg => {
        const k = iso(arg.date), td = arg.el;
        td.tabIndex = 0;
        td.setAttribute('role', 'button');
        td.setAttribute('aria-label', krDate(k) + (written.has(k) ? ', 일기 있음' : ''));
        td.addEventListener('click', () => openDiary(k));
        td.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openDiary(k); } });
      },
      datesSet: info => {
        const a = info.start, b = addDays(info.start, 6);
        document.getElementById('weekTitle').textContent = pad(a.getMonth() + 1) + '.' + pad(a.getDate()) + ' – ' + pad(b.getMonth() + 1) + '.' + pad(b.getDate());
        markDiaryDay();
      }
    });
    weekCal.render();
    markDiaryDay();
  }
  function markDiaryDay() {
    document.querySelectorAll('#weekCal td.fc-daygrid-day').forEach(td => {
      td.classList.toggle('sel', td.dataset.date === diaryDay);
      td.setAttribute('aria-pressed', td.dataset.date === diaryDay);
    });
  }
  const leaveOk = () => !diaryDirty() || confirm('저장하지 않은 일기가 있어요. 그래도 이동할까요?');
  document.getElementById('weekPrev').addEventListener('click', () => weekCal.prev());
  document.getElementById('weekNext').addEventListener('click', () => weekCal.next());

  function setDiaryMode(mode) {   // 'empty' | 'view' | 'edit' | 'future'
    diaryEditing = mode === 'empty' || mode === 'edit';
    diaryText.readOnly = !diaryEditing;
    diaryText.classList.toggle('editing', diaryEditing);
    diaryEdit.hidden = diarySave.hidden = mode === 'future';
    diaryEdit.disabled = mode !== 'view';
    diarySave.disabled = mode === 'view' || (mode === 'empty' && !diaryText.value.trim());
    diaryNote.hidden = mode !== 'future';
  }
  async function openDiary(k) {
    if (k !== diaryDay && !leaveOk()) return;
    diaryDay = k;
    markDiaryDay();
    document.getElementById('diaryDate').textContent = krDate(k) + (k === todayIso ? ' · 오늘' : '');
    const d = await PrincessDB.diaries.get(k);
    diarySaved = d ? d.text : '';
    diaryText.value = diarySaved;
    diaryText.placeholder = k === todayIso ? '오늘의 일기를 작성해 주세요 ・₊✧' : '이 날의 일기를 작성해 주세요 ・₊✧';
    if (d) setDiaryMode('view');
    else if (k > todayIso) { diaryText.placeholder = ''; setDiaryMode('future'); }
    else setDiaryMode('empty');
  }
  async function saveDiary() {
    const text = diaryText.value.replace(/\s+$/, '');
    if (text.trim()) await PrincessDB.diaries.save(diaryDay, text);
    else await PrincessDB.diaries.remove(diaryDay);   // 다 지우고 저장하면 그 날 일기 삭제
    diarySaved = text;
    await renderWeekCal();
    await openDiary(diaryDay);
    showToast(text.trim() ? '일기를 저장했어요 ・₊✧' : '일기를 지웠어요');
  }
  // 처음 쓰는 날은 빈 칸이면 저장 비활성, 이미 쓴 날은 다 지우고 저장하면 삭제
  diaryText.addEventListener('input', () => { if (!diarySaved) diarySave.disabled = !diaryText.value.trim(); });
  diarySave.addEventListener('click', saveDiary);
  diaryEdit.addEventListener('click', () => {
    setDiaryMode('edit');
    diaryText.focus();
    diaryText.setSelectionRange(diaryText.value.length, diaryText.value.length);
  });

  // ---- 테마: 캐릭터(토끼/네잎클로버) + 색상 팔레트 6가지, DB에 저장 ----
  const THEMES = [   // 설정에 보여줄 순서와 견본 색 (실제 색값은 CSS의 :root[data-theme])
    { id: 'black', name: '검정', swatch: '#1f1c24' }, { id: 'blue', name: '파랑', swatch: '#6f9be0' },
    { id: 'yellow', name: '노랑', swatch: '#e5b84a' }, { id: 'pink', name: '분홍', swatch: '#e88db0' },
    { id: 'green', name: '초록', swatch: '#6fbb8a' }, { id: 'white', name: '흰색', swatch: '#ffffff' }
  ];
  const CHAR_LABEL = { bunny: '꼬물거리는 하얀 토끼, 하트가 퐁퐁', clover: '흔들흔들 네잎클로버, 하트가 퐁퐁' };
  let prefs = Object.assign({ theme: 'pink', character: 'bunny', notify: false }, await PrincessDB.prefs.get());
  function applyTheme() {
    if (prefs.theme === 'pink') delete document.documentElement.dataset.theme;
    else document.documentElement.dataset.theme = prefs.theme;
    try { localStorage.setItem('princessTodo.theme', prefs.theme); } catch (e) {}
    character = prefs.character;
    document.documentElement.dataset.char = character;
    showHearts(Number(heartCount.textContent) || 0);
    document.querySelector('.bunny-wrap').setAttribute('aria-label', CHAR_LABEL[character]);
    if (drawCharacter) drawCharacter();
    document.querySelectorAll('.char-opt[data-char]').forEach(b => b.setAttribute('aria-checked', b.dataset.char === character));
    document.querySelectorAll('.swatch').forEach(b => b.setAttribute('aria-checked', b.dataset.theme === prefs.theme));
    updateFavicon();
    // 상태바(주소창) 색도 테마 배경색으로
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = getComputedStyle(document.documentElement).getPropertyValue('--blush').trim() || '#fbe9f1';
    renderBell();
    scheduleNotify();
  }
  document.getElementById('swatches').innerHTML = THEMES.map(t =>
    '<button type="button" class="swatch" role="radio" data-theme="' + t.id + '"><i style="background:' + t.swatch + '"></i>' + t.name + '</button>').join('');
  async function setPref(key, value) {
    prefs[key] = value;
    await PrincessDB.prefs.set(prefs);
    applyTheme();
    renderCal();   // 달력 오늘 칸 등 색 다시
  }
  document.querySelectorAll('.char-opt[data-char]').forEach(b => b.addEventListener('click', () => setPref('character', b.dataset.char)));
  document.querySelectorAll('.swatch').forEach(b => b.addEventListener('click', () => setPref('theme', b.dataset.theme)));

  // ---- 배경 사진: 사용자가 고른 사진을 줄여서 폰 안 DB에 저장, 눈 효과는 그 위에 그대로 ----
  const bgPhoto = document.getElementById('bgPhoto'), bgThumb = document.getElementById('bgThumb');
  let bgUrl = null;
  function showBackground(blob) {
    if (bgUrl) URL.revokeObjectURL(bgUrl);
    bgUrl = blob ? URL.createObjectURL(blob) : null;
    bgPhoto.hidden = bgThumb.hidden = !bgUrl;
    bgPhoto.style.backgroundImage = bgThumb.style.backgroundImage = bgUrl ? 'url("' + bgUrl + '")' : '';
    document.getElementById('bgPick').setAttribute('aria-checked', !!bgUrl);
    document.getElementById('bgDefault').setAttribute('aria-checked', !bgUrl);
  }
  // 큰 사진은 긴 변 1600px JPEG로 줄여서 저장 (폰 저장 공간 아끼기)
  async function shrinkImage(file) {
    const img = await createImageBitmap(file);
    const scale = Math.min(1, 1600 / Math.max(img.width, img.height));
    const c = document.createElement('canvas');
    c.width = Math.round(img.width * scale); c.height = Math.round(img.height * scale);
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    return new Promise(ok => c.toBlob(ok, 'image/jpeg', 0.85));
  }
  const bgFile = document.getElementById('bgFile');
  document.getElementById('bgPick').addEventListener('click', () => bgFile.click());
  bgFile.addEventListener('change', async () => {
    const file = bgFile.files && bgFile.files[0];
    bgFile.value = '';
    if (!file) return;
    try {
      const blob = await shrinkImage(file);
      await PrincessDB.background.set(blob);
      showBackground(blob);
      showToast('배경을 바꿨어요 ・₊✧');
    } catch (e) { showToast('이 사진은 불러올 수 없어요'); }
  });
  document.getElementById('bgDefault').addEventListener('click', async () => {
    await PrincessDB.background.clear();
    showBackground(null);
    showToast('기본 배경으로 돌아왔어요');
  });
  showBackground(await PrincessDB.background.get());

  // ---- 백업 / 복원 ----
  const BACKUP_KEY = 'last-backup';
  async function showBackupInfo() {
    const last = await PrincessDB.cache.get(BACKUP_KEY);
    document.getElementById('backupInfo').textContent = last ? '마지막 백업: ' + new Date(last.savedAt).toLocaleString('ko-KR', { dateStyle: 'medium', timeStyle: 'short' }) : '';
  }
  document.getElementById('backupSave').addEventListener('click', async () => {
    const data = await PrincessDB.exportAll();
    const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
    const name = 'todo-backup-' + iso(new Date()) + '.json';
    const file = new File([blob], name, { type: 'application/json' });
    // 폰은 공유 시트(파일에 저장·카톡 등), 컴퓨터는 바로 다운로드
    if (navigator.canShare && navigator.canShare({ files: [file] }) && /iPhone|iPad|Android/i.test(navigator.userAgent)) {
      try { await navigator.share({ files: [file], title: name }); } catch (e) { if (e.name === 'AbortError') return; }
    } else {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob); a.download = name;
      document.body.append(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    }
    await PrincessDB.cache.set(BACKUP_KEY, { name });
    showBackupInfo();
    showToast('백업 파일을 만들었어요 ・₊✧');
  });
  const backupFile = document.getElementById('backupFile');
  document.getElementById('backupLoad').addEventListener('click', () => backupFile.click());
  backupFile.addEventListener('change', async () => {
    const file = backupFile.files && backupFile.files[0];
    backupFile.value = '';
    if (!file) return;
    let data;
    try { data = JSON.parse(await file.text()); } catch (e) { showToast('백업 파일을 읽을 수 없어요'); return; }
    if (!data || data.app !== 'princess-todo') { showToast('이 앱의 백업 파일이 아니에요'); return; }
    const when = data.exportedAt ? new Date(data.exportedAt).toLocaleString('ko-KR', { dateStyle: 'medium', timeStyle: 'short' }) : '';
    if (!confirm(when + ' 백업으로 되돌릴까요?\n지금 있는 할 일·일기·설정은 백업 내용으로 바뀌어요.')) return;
    try {
      await PrincessDB.importAll(data);
      showToast('백업을 불러왔어요. 새로 열게요');
      setTimeout(() => location.reload(), 900);
    } catch (e) { showToast('불러오지 못했어요: ' + (e.message || '알 수 없는 오류')); }
  });
  showBackupInfo();

  // ---- 알림: 7시 날씨 / 12시 점심 / 18시 하루 마무리 / 21시 내일 날씨 / 23시 굿나잇 ----
  // 1) 푸시 서버(push-server/, Cloudflare Workers)가 정각마다 보내면 앱을 닫아도 와요.
  // 2) 푸시를 못 쓰는 환경에서는 앱이 열려 있는 동안만 이 페이지가 직접 보내요.
  // 문구는 notify.js 한 곳에서 만들어요 (서비스 워커도 같은 파일 사용).
  const PUSH = {
    server: 'https://princess-todo-push.bbhtodo.workers.dev',   // push-server/ 를 Cloudflare에 배포한 주소
    vapidPublicKey: 'BAIlPVFp_780lMELmtdgFzZCcEbL9XOCrki5I4M2x_v6tk49QKnRCtSAgII-gpvKr1ZQX9MXCnVG5XWdufn2_LA'
  };
  const NOTIFY_HOURS = TodoNotify.HOURS;
  async function notifyMessage(hour) {
    const k = iso(new Date());
    const weather = hour === 7 || hour === 21 ? await fetchWeather().catch(() => null) : null;
    const left = hour === 18 ? (await PrincessDB.todos.all()).filter(t => t.date === k && !t.done).length : 0;
    return TodoNotify.buildMessage(hour, { name: profile && profile.name, weather, left });
  }
  let swReg = null, pushActive = false;
  const swReady = 'serviceWorker' in navigator
    ? navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).then(r => (swReg = r)).catch(() => null) : Promise.resolve(null);
  // 새 버전 서비스 워커가 자리를 잡으면 한 번 새로고침해서 새 화면을 바로 보여줌 (처음 설치 때는 제외)
  if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
    let reloaded = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (reloaded || diaryDirty() || document.querySelector('dialog[open]')) return;
      reloaded = true; location.reload();
    });
  }
  async function sendNotification(body, tag) {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    const opts = { body, tag, icon: 'icons/icon-192.png', badge: 'icons/badge-96.png' };   // 배지는 상단바용 흰 TO/DO
    try { if (swReg) { await swReg.showNotification('₊‧Todo‧₊', opts); return; } } catch (e) {}
    try { new Notification('₊‧Todo‧₊', opts); } catch (e) {}
  }

  // 푸시 구독: 서버에는 구독 정보 + 대략적인 위치(소수 둘째 자리, 약 1km) + 시간대만 보내요
  const b64ToBytes = b64 => {
    const s = atob((b64 + '='.repeat((4 - b64.length % 4) % 4)).replace(/-/g, '+').replace(/_/g, '/'));
    return Uint8Array.from(s, c => c.charCodeAt(0));
  };
  async function enablePush() {
    const reg = await swReady;
    if (!PUSH.server || !reg || !('PushManager' in window)) return false;
    try {
      const sub = (await reg.pushManager.getSubscription()) ||
        (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(PUSH.vapidPublicKey) }));
      const pos = await getPosition().catch(() => null);
      const round = x => Math.round(x * 100) / 100;
      const res = await fetch(PUSH.server + '/subscribe', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          subscription: sub.toJSON(),
          lat: pos ? round(pos.coords.latitude) : null, lon: pos ? round(pos.coords.longitude) : null,
          tz: Intl.DateTimeFormat().resolvedOptions().timeZone
        })
      });
      return res.ok;
    } catch (e) { return false; }
  }
  async function disablePush() {
    const reg = await swReady;
    const sub = reg && reg.pushManager && await reg.pushManager.getSubscription().catch(() => null);
    if (!sub) return;
    if (PUSH.server) fetch(PUSH.server + '/unsubscribe', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ endpoint: sub.endpoint }) }).catch(() => {});
    await sub.unsubscribe().catch(() => {});
  }
  // 앱을 열 때마다 구독을 서버에 다시 알려서 위치·시간대를 최신으로
  async function refreshPush() {
    pushActive = !!prefs.notify && 'Notification' in window && Notification.permission === 'granted' && await enablePush();
    scheduleNotify();
  }

  // 푸시를 못 쓸 때: 다음 알림 시각에 맞춰 타이머. 같은 시간 알림은 하루에 한 번만
  let notifyTimer;
  function scheduleNotify() {
    clearTimeout(notifyTimer);
    if (!prefs.notify || pushActive) return;
    const n = new Date(), next = new Date(n);
    const h = NOTIFY_HOURS.find(x => x > n.getHours());
    if (h === undefined) { next.setDate(next.getDate() + 1); next.setHours(NOTIFY_HOURS[0], 0, 0, 0); }
    else next.setHours(h, 0, 0, 0);
    notifyTimer = setTimeout(fireNotify, Math.max(1000, next - n));
  }
  async function fireNotify() {
    const n = new Date(), k = iso(n), slot = NOTIFY_HOURS.includes(n.getHours()) ? n.getHours() : null;   // 1시간 넘게 늦으면 건너뜀
    const log = (await PrincessDB.cache.get('notify-log')) || { value: {} };
    const sentToday = log.value.date === k ? (log.value.sent || []) : [];
    if (slot !== null && prefs.notify && !pushActive && !sentToday.includes(slot)) {
      await sendNotification(await notifyMessage(slot), 'todo-' + slot);
      await PrincessDB.cache.set('notify-log', { date: k, sent: sentToday.concat(slot) });
    }
    scheduleNotify();
  }
  document.addEventListener('visibilitychange', () => { if (!document.hidden) scheduleNotify(); });

  // 설정의 종 버튼: 켜면 알림 권한 요청 → 푸시 구독 → 확인 알림
  const bell = document.getElementById('bellBtn');
  function renderBell() {
    const on = !!prefs.notify && 'Notification' in window && Notification.permission === 'granted';
    bell.classList.toggle('on', on);
    bell.setAttribute('aria-pressed', on);
    bell.setAttribute('aria-label', on ? '알림 켜짐, 누르면 꺼요' : '알림 꺼짐, 누르면 켜요');
  }
  bell.addEventListener('click', async () => {
    if (bell.classList.contains('on')) {
      await setPref('notify', false); disablePush(); pushActive = false;
      showToast('알림을 껐어요'); return;
    }
    if (!('Notification' in window)) { showToast('이 브라우저는 알림을 지원하지 않아요. 아이폰은 홈 화면에 추가한 앱에서 켜 주세요'); return; }
    const perm = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission();
    if (perm !== 'granted') { showToast('브라우저 설정에서 알림을 허용해 주세요'); renderBell(); return; }
    await setPref('notify', true);
    await refreshPush();
    showToast(pushActive ? '알림을 켰어요 ・₊✧ 앱을 닫아도 찾아올게요' : '알림을 켰어요 ・₊✧ (앱이 열려 있을 때만 와요)');
    if (pushActive) {   // 확인 알림을 푸시 서버를 거쳐 보내서 연결까지 확인
      const sub = await swReg.pushManager.getSubscription();
      fetch(PUSH.server + '/test', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ endpoint: sub.endpoint }) }).catch(() => {});
    } else sendNotification('알림을 켰어요 ・₊✧ 매일 7시·12시·18시·21시·23시에 찾아올게요', 'todo-on');
  });

  // ---- 사이트 아이콘: 투명 배경에 TO / DO, 고른 테마 색으로 ----
  let faviconUrl = '';
  function updateFavicon() {
    const color = getComputedStyle(document.documentElement).getPropertyValue('--rose').trim() || '#c95a86';
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const g = c.getContext('2d');
    g.fillStyle = color; g.textAlign = 'center'; g.textBaseline = 'alphabetic';
    g.font = '700 30px "Cormorant Garamond", Georgia, "Times New Roman", serif';
    g.fillText('TO', 32, 29); g.fillText('DO', 32, 60);
    faviconUrl = c.toDataURL('image/png');
    let link = document.querySelector('link[rel="icon"]');
    if (!link) { link = document.createElement('link'); link.rel = 'icon'; document.head.append(link); }
    link.type = 'image/png'; link.href = faviconUrl;
  }

  // ---- 프로필: 처음 켤 때 이름·생년월일 묻기, 설정에서 수정 ----
  const pfDlg = document.getElementById('profileDialog'), pfName = document.getElementById('pfName'),
    pfBirth = document.getElementById('pfBirth'), pfOk = document.getElementById('pfOk');
  pfBirth.max = todayIso;
  let onboarding = false;
  function openProfile(first) {
    onboarding = first;
    pfDlg.classList.toggle('onboarding', first);
    document.getElementById('pfTitle').textContent = first ? 'Welcome' : 'Edit Profile';
    document.getElementById('pfSub').textContent = first ? '처음 오셨네요 ・₊✧ 어떻게 불러 드릴까요?' : '이름과 생년월일을 바꿀 수 있어요';
    pfOk.textContent = first ? '시작하기' : '저장';
    pfName.value = profile ? profile.name : '';
    pfBirth.value = profile ? profile.birth : '';
    checkProfile();
    pfDlg.showModal(); pfName.focus();
  }
  const checkProfile = () => { pfOk.disabled = !pfName.value.trim() || !pfBirth.value; };
  pfName.addEventListener('input', checkProfile);
  pfBirth.addEventListener('input', checkProfile);
  pfBirth.addEventListener('change', checkProfile);
  pfDlg.addEventListener('cancel', e => { if (onboarding) e.preventDefault(); });   // 처음엔 Esc로 닫기 막기
  document.getElementById('pfCancel').addEventListener('click', () => pfDlg.close());
  document.getElementById('profileForm').addEventListener('submit', async e => {
    e.preventDefault();
    if (pfOk.disabled) return;
    await PrincessDB.profile.set(pfName.value.trim(), pfBirth.value);
    profile = await PrincessDB.profile.get();
    pfDlg.close();
    renderCheer(); renderSettings();
    showToast(onboarding ? '반가워요, ' + esc(profile.name) + '님 ・₊✧' : '프로필을 바꿨어요');
  });
  document.getElementById('profileEdit').addEventListener('click', () => openProfile(false));

  // 설정 화면: 프로필 사진은 메인 화면의 토끼를 그대로 비춰서 보여줌
  let avatarTimer;
  function renderSettings() {
    document.getElementById('profileName').textContent = profile ? profile.name + '님' : '';
    document.getElementById('profileBirth').textContent = profile && profile.birth ? profile.birth.replace(/-/g, '. ') + '.' : '';
  }
  function startAvatar() {
    const src = document.getElementById('bunny'), dst = document.getElementById('avatar'), g = dst.getContext('2d');
    const draw = () => { g.clearRect(0, 0, dst.width, dst.height); g.imageSmoothingEnabled = false; g.drawImage(src, 0, 0, dst.width, dst.height); };
    clearInterval(avatarTimer); draw(); avatarTimer = setInterval(draw, 110);
  }

  // ---- 화면 전환 (하단 탭바, 주소 #add 로 뒤로가기 지원) ----
  const PAGES = { home: 'page-home', add: 'page-add', done: 'page-done', diary: 'page-diary', settings: 'page-settings' };
  function showPage(name) {
    if (!PAGES[name]) name = 'home';
    Object.entries(PAGES).forEach(([k, id]) => { document.getElementById(id).hidden = k !== name; });
    document.querySelectorAll('.nav button').forEach(b => {
      if (b.dataset.page === name) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
    });
    // 숨겨진 상태에서 그린 달력은 폭이 0이라, 화면이 보일 때 다시 그림
    if (name === 'home') renderCal();
    if (name === 'add') { renderMonth(); renderDay(); }
    if (name === 'done') renderDone();
    if (name === 'settings') { renderSettings(); startAvatar(); } else clearInterval(avatarTimer);
    if (name === 'diary') { diaryDay = todayIso; if (weekCal) { weekCal.destroy(); weekCal = null; } renderWeekCal(); openDiary(todayIso); }
    window.scrollTo(0, 0);
  }
  document.querySelectorAll('.nav button').forEach(b => b.addEventListener('click', () => {
    const page = b.dataset.page;
    if (!document.getElementById('page-diary').hidden && page !== 'diary' && !leaveOk()) return;
    if (!PAGES[page]) { showToast(esc(b.textContent.trim()) + ' 화면은 다음에 같이 만들어요 ♡'); return; }
    if (location.hash !== '#' + page) location.hash = page === 'home' ? '' : page;
    else showPage(page);
  }));
  window.addEventListener('hashchange', () => showPage(location.hash.slice(1)));
  showPage(location.hash.slice(1));
  if (!profile) openProfile(true);

  // ---- 자정을 넘기면 날짜·멘트·하트·달력을 새로 (쓰던 일기나 열린 팝업이 있으면 끝난 뒤에) ----
  function checkNewDay() {
    if (iso(new Date()) === todayIso || diaryDirty() || document.querySelector('dialog[open]')) return;
    location.reload();
  }
  setInterval(checkNewDay, 60 * 1000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) checkNewDay(); });

  // ---- 픽셀 캐릭터: 토끼(꼬물꼬물) / 네잎클로버(흔들흔들) + 하트 ----
  (function () {
    const cvb = document.getElementById('bunny'), g = cvb.getContext('2d');
    const GW = 32, GH = 30, P = 4, dpr = window.devicePixelRatio || 1;
    cvb.width = GW * P * dpr; cvb.height = GH * P * dpr;
    g.setTransform(dpr, 0, 0, dpr, 0, 0); g.imageSmoothingEnabled = false;
    const COL = { o: '#cbbdd6', w: '#ffffff', s: '#eee8f5', p: '#f7c1d5', e: '#2b1d2a', h: '#ffffff', n: '#e27c9e', b: '#ffd6e4', g: 'rgba(150,120,180,.16)' };
    const HEART = ['.xx.xx.', 'xxxxxxx', 'xxxxxxx', '.xxxxx.', '..xxx..', '...x...'];
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let t = 0, hearts = [];
    const ell = (x, y, cx, cy, rx, ry) => { const dx = (x + .5 - cx) / rx, dy = (y + .5 - cy) / ry; return dx * dx + dy * dy <= 1; };

    function spawn() { hearts.push({ x: 20 + Math.random() * 5, y: 6, life: 0, ph: Math.random() * 6 }); }

    function render() {
      g.clearRect(0, 0, GW * P, GH * P);
      if (character === 'clover') renderClover(); else renderBunny();
      drawHearts();
    }

    // 네잎클로버: 줄기 아래를 축으로 좌우로 흔들흔들
    function renderClover() {
      const sway = Math.sin(t * 0.18) * 2.2;                     // 꼭대기 기준 최대 흔들림(칸)
      const lean = y => Math.round(sway * (27 - y) / 20);          // 아래로 갈수록 덜 흔들림
      const blink = (t % 41) < 2;
      const CX = 16, CY = 11;                                      // 네 잎이 만나는 가운데
      const leaves = [[-4.3, -4.1], [4.3, -4.1], [-4.3, 4.1], [4.3, 4.1]];
      // 잎 하나 = 동그라미 두 개를 붙인 하트 모양
      const leaf = (x, y) => leaves.some(([dx, dy]) => {
        const cx = CX + dx + lean(y), cy = CY + dy;
        const sx = Math.sign(dx), sy = Math.sign(dy);
        return ell(x, y, cx - sx * 1.1, cy + sy * 0.9, 2.9, 2.9) || ell(x, y, cx + sx * 0.9, cy - sy * 1.1, 2.9, 2.9);
      });
      const cross = (x, y) => (x === CX + lean(y) && Math.abs(y - CY) <= 7) || (y === CY && Math.abs(x - CX - lean(y)) <= 7);
      const stem = (x, y) => y > CY && y <= 27 && x === CX + lean(y) + (y >= 24 ? -1 : 0);
      const px = (x, y, c) => { g.fillStyle = c; g.fillRect(x * P, y * P, P, P); };
      const C = { o: '#3f7d4a', l: '#7cc47f', hl: '#b6e3a8', st: '#4e9a57', e: '#2b1d2a', b: '#f7a8c4' };
      const isLeaf = (x, y) => leaf(x, y) && !cross(x, y);
      for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) {
        if (isLeaf(x, y)) {
          let c = C.l;
          leaves.forEach(([dx, dy]) => { if (ell(x, y, CX + dx + lean(y) - 1.2, CY + dy - 1.4, 1.3, 1.1)) c = C.hl; });
          px(x, y, c);
        } else if (leaf(x, y) || isLeaf(x - 1, y) || isLeaf(x + 1, y) || isLeaf(x, y - 1) || isLeaf(x, y + 1)) {
          px(x, y, C.o);                                           // 테두리 + 잎 사이 경계선
        } else if (stem(x, y)) {
          px(x, y, C.st);
        } else if (y === 28 && x > 9 && x < 23) {
          px(x, y, COL.g);
        }
      }
      // 가운데 동그란 얼굴
      const fx = CX + lean(CY);
      for (let y = CY - 2; y <= CY + 2; y++) for (let x = fx - 3; x <= fx + 3; x++) {
        if (ell(x, y, fx + .5, CY + .5, 3.4, 2.6)) px(x, y, C.l);
      }
      if (blink) { px(fx - 2, CY, C.e); px(fx + 2, CY, C.e); }
      else { px(fx - 2, CY - 1, C.e); px(fx - 2, CY, C.e); px(fx + 2, CY - 1, C.e); px(fx + 2, CY, C.e); }
      px(fx - 3, CY + 1, C.b); px(fx + 3, CY + 1, C.b);
      px(fx, CY + 1, C.e);
    }

    function renderBunny() {
      const br = Math.sin(t * 0.5);                 // 숨쉬기
      const rx = 12.6 - br * 0.6, ry = 7.4 + br * 0.8;
      const bob = br > 0.2 ? 0 : 1;                 // 머리 끄덕
      const sw = Math.round(Math.sin(t * 0.22));    // 몸 좌우 꼬물
      const twitch = (t % 26) < 3;                  // 귀 쫑긋
      const wig = (t % 4) < 2;                      // 코 씰룩
      const blink = (t % 37) < 2;                   // 눈 깜빡
      const body = (x, y) => y <= 27 && ell(x, y, 17, 20, rx, ry);
      const head = (x, y) => ell(x, y, 13 + sw, 15.5 + bob, 8, 7);
      const earL = (x, y) => ell(x, y, (twitch ? 8.6 : 9.8) + sw, 7 + bob + (twitch ? 1 : 0), 2.1, 5);
      const earR = (x, y) => ell(x, y, 16.2 + sw, 6.6 + bob, 2.1, 5.2);
      const pinkL = (x, y) => ell(x, y, (twitch ? 8.6 : 9.8) + sw, 7.6 + bob + (twitch ? 1 : 0), .9, 3.4);
      const pinkR = (x, y) => ell(x, y, 16.2 + sw, 7.2 + bob, .9, 3.6);
      const ins = (x, y) => x >= 0 && y >= 0 && x < GW && y < GH && (body(x, y) || head(x, y) || earL(x, y) || earR(x, y));

      const px = (x, y, c) => { g.fillStyle = c; g.fillRect(x * P, y * P, P, P); };
      for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) {
        if (ins(x, y)) {
          let c = COL.w;
          if (pinkL(x, y) || pinkR(x, y)) c = COL.p;
          else if (body(x, y) && !head(x, y) && (y >= 25 || x >= 26)) c = COL.s;
          px(x, y, c);
        } else if (ins(x - 1, y) || ins(x + 1, y) || ins(x, y - 1) || ins(x, y + 1)) {
          px(x, y, COL.o);
        } else if (y === 28 && x > 4 && x < 30) {
          px(x, y, COL.g);
        }
      }
      // 얼굴
      const ex1 = 9 + sw, ex2 = 15 + sw, ey = 14 + bob;
      [ex1, ex2].forEach(ex => {
        if (blink) { px(ex, ey + 1, COL.e); px(ex + 1, ey + 1, COL.e); }
        else {
          for (let yy = 0; yy < 3; yy++) { px(ex, ey + yy - 1, COL.e); px(ex + 1, ey + yy - 1, COL.e); }
          g.fillStyle = COL.h; g.fillRect((ex + 1) * P, (ey - 1) * P, P / 2, P / 2);
        }
      });
      px(7 + sw, ey + 3, COL.b); px(8 + sw, ey + 3, COL.b);
      px(17 + sw, ey + 3, COL.b); px(18 + sw, ey + 3, COL.b);
      const nx = 12 + sw, ny = ey + 3;
      if (wig) { px(nx, ny, COL.n); px(nx + 1, ny, COL.n); px(nx, ny + 1, COL.n); }
      else { px(nx - 1, ny, COL.n); px(nx + 1, ny, COL.n); px(nx, ny + 1, COL.n); }
    }

    function drawHearts() {
      const px = (x, y, c) => { g.fillStyle = c; g.fillRect(x * P, y * P, P, P); };
      hearts.forEach(h => {
        const a = h.life > 14 ? Math.max(0, 1 - (h.life - 14) / 8) : 1;
        g.globalAlpha = a;
        const hx = Math.round(h.x + Math.sin(h.ph + h.life * .4)), hy = Math.round(h.y);
        HEART.forEach((row, r) => [...row].forEach((ch, cI) => {
          if (ch === 'x') px(hx + cI, hy + r, (r === 1 && cI === 1) ? '#ffe3ee' : '#ec8db2');
        }));
        g.globalAlpha = 1;
      });
    }

    drawCharacter = render;
    if (reduce) { hearts.push({ x: 21, y: 2, life: 0, ph: 0 }); render(); return; }
    setInterval(() => {
      t++;
      if (t % 9 === 0) spawn();
      hearts.forEach(h => { h.y -= .55; h.life++; });
      hearts = hearts.filter(h => h.life < 22);
      render();
    }, 110);
    cvb.addEventListener('click', () => { spawn(); spawn(); spawn(); });
    render();
  })();

  applyTheme();
  refreshPush();
  // 준비 끝 → 로딩 화면 걷기
  requestAnimationFrame(() => {
    const sp = document.getElementById('splash');
    sp.classList.add('hide');
    setTimeout(() => sp.remove(), 400);
  });
  document.fonts && document.fonts.ready.then(updateFavicon);   // 글꼴이 늦게 오면 아이콘 다시

  // ---- 눈 내리는 배경 ----
  const cv = document.getElementById('snow');
  const ctx = cv.getContext('2d');
  const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let W, H, flakes = [];
  function resize() {
    const r = window.devicePixelRatio || 1;
    W = cv.clientWidth || window.innerWidth; H = cv.clientHeight || window.innerHeight;   // 폰 틀 안에서는 틀 크기
    cv.width = W * r; cv.height = H * r; ctx.setTransform(r, 0, 0, r, 0, 0);
  }
  resize(); window.addEventListener('resize', resize);
  for (let i = 0; i < 46; i++) flakes.push({ x: Math.random() * W, y: Math.random() * H, r: Math.random() * 2.2 + .6, s: Math.random() * .45 + .15, w: Math.random() * 6.28, gold: Math.random() < .18 });
  function draw() {
    ctx.clearRect(0, 0, W, H);
    for (const f of flakes) {
      ctx.beginPath(); ctx.arc(f.x, f.y, f.r, 0, 6.28);
      ctx.fillStyle = f.gold ? 'rgba(214,180,100,.75)' : 'rgba(255,255,255,.95)';
      ctx.shadowColor = f.gold ? 'rgba(241,220,158,.9)' : 'rgba(170,190,230,.8)'; ctx.shadowBlur = 6;
      ctx.fill();
      if (!still) {
        f.y += f.s; f.w += .01; f.x += Math.sin(f.w) * .3;
        if (f.y > H + 4) { f.y = -4; f.x = Math.random() * W; }
      }
    }
    if (!still) requestAnimationFrame(draw);
  }
  draw();
})();
