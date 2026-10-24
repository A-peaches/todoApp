// 공주 투두 알림 문구 (앱 화면과 서비스 워커가 같이 씀)
// 서버는 "몇 시 알림인지 + 날씨 숫자"만 보내고, 이름·남은 할 일은 폰 안에서 붙여 완성해요.
(function (root) {
  const HOURS = [7, 12, 18, 21, 23];
  const pick = list => list[Math.floor(Math.random() * list.length)];

  const LUNCH = [
    '점심 식사 중이신가요? 맛있게 드시고 남은 오후도 화이팅!',
    '점심은 드셨어요? 든든하게 먹고 오후도 힘내요',
    '벌써 점심시간이에요. 잠깐 쉬어 가요 ・₊✧',
    '오늘 점심 메뉴는 뭐예요? 맛있는 거 먹고 기분 충전해요',
    '오전도 수고했어요. 따뜻한 밥 한 끼 챙겨 먹어요',
    '바빠도 점심은 꼭 챙겨요. 오후는 더 잘될 거예요',
    '식사 후에 물 한 잔, 잊지 마세요',
    '점심 먹고 잠깐 햇빛 쬐는 건 어때요?'
  ];
  const EVENING = [
    '오늘 하루도 고생 많았어요. 투두에서 잊은 게 없는지 확인해 보실래요?',
    '퇴근 시간이에요! 오늘 할 일 다 끝냈는지 한번 볼까요?',
    '하루가 저물어 가요. 남은 할 일이 있는지 살짝 확인해 봐요',
    '오늘도 정말 수고했어요. 체크 못 한 일은 없나요?',
    '저녁 시간이에요. 투두 한 번 보고 마음 편히 쉬어요',
    '오늘 한 일, 하나씩 체크해 봐요. 뿌듯할 거예요'
  ];
  const NIGHT = [
    '좋은 밤 되세요. 오늘도 수고 많았어요 ・₊✧',
    '이제 푹 쉬어요. 내일도 반짝이는 하루가 될 거예요',
    '오늘 하루도 잘 해냈어요. 편안한 밤 보내요',
    '따뜻하게 덮고 푹 자요. 좋은 꿈 꿔요',
    '내일 또 만나요. 굿나잇 ・₊✧',
    '휴대폰 내려놓고 푹 잘 시간이에요'
  ];
  const WX_TOMORROW = { sun: '맑을 예정이에요', partly: '구름이 조금 낄 예정이에요', cloud: '흐릴 예정이에요',
    rain: '비 소식이 있어요', snow: '눈 소식이 있어요', storm: '천둥번개 소식이 있어요' };

  // WMO 날씨 코드 → 종류
  const wxKind = c => c <= 1 ? 'sun' : c === 2 ? 'partly' : c <= 48 ? 'cloud'
    : (c >= 71 && c <= 77) || c === 85 || c === 86 ? 'snow' : c >= 95 ? 'storm' : 'rain';

  // 날씨 팁: 기온(최저·최고 둘 다 기준), 비·눈, 더위, 건조
  // w = { min: [오늘, 내일], max: [...], code: [...], rain: [강수확률], hum: [평균 습도] }, i = 0 오늘 / 1 내일
  function weatherTips(w, i) {
    const lo = Math.round(w.min[i]), hi = Math.round(w.max[i]), kind = wxKind(w.code[i]);
    const tips = [];
    if (kind === 'snow') tips.push('눈이 와요, 우산 챙기는 거 잊지 마세요');
    else if (kind === 'rain' || kind === 'storm' || (w.rain && w.rain[i] >= 60)) tips.push('비가 와요, 우산 챙기는 거 잊지 마세요');
    if (hi < 10) tips.push('따뜻한 외투를 걸치세요');            // 최저·최고 모두 10도 미만
    else if (hi < 20) tips.push('가벼운 외투를 챙겨 나가요');      // 최저·최고 모두 20도 미만
    if (hi > 30) tips.push('많이 더워요, 물을 많이 마시세요');
    if (w.hum && w.hum[i] < 40) tips.push('많이 건조해요, 물을 많이 챙겨 드세요');
    return { lo, hi, kind, tips };
  }

  // slot: 7·12·18·21·23 / name: 사용자 이름 / weather: 위 모양 (없으면 날씨 없이) / left: 오늘 남은 할 일 수
  function buildMessage(slot, { name, weather, left } = {}) {
    const call = name ? name + '님, ' : '';
    if (slot === 7 || slot === 21) {
      if (!weather) return slot === 7 ? call + '좋은 아침이에요! 오늘도 반짝이는 하루 보내요' : call + '내일도 기대되는 하루예요. 잊은 일이 없나 확인해 봐요';
      if (slot === 7) {
        const { lo, hi, tips } = weatherTips(weather, 0);
        return call + '오늘의 날씨는 최저 ' + lo + '도, 최고 ' + hi + '도예요.' + (tips.length ? ' ' + tips.join('. ') + '.' : '');
      }
      const { lo, hi, kind, tips } = weatherTips(weather, 1);
      const wet = tips.some(x => x.includes('우산'));
      const rest = tips.filter(x => !x.includes('우산'));   // 비·눈은 앞 문장에서 이미 말했으니 우산만 따로
      const phrase = wet && (kind === 'sun' || kind === 'partly' || kind === 'cloud') ? '비 소식이 있어요' : WX_TOMORROW[kind];
      return call + '내일의 날씨는 최저 ' + lo + '도, 최고 ' + hi + '도이고 ' + phrase + '.' +
        (wet ? ' 우산을 미리 챙겨 두세요.' : '') + (rest.length ? ' ' + rest.join('. ') + '.' : '') +
        ' 옷은 미리 챙겨 두시고, 잊은 일이 없나 확인해 봐요.';
    }
    if (slot === 12) return call + pick(LUNCH);
    if (slot === 18) return call + pick(EVENING) + (left ? ' (오늘 남은 할 일 ' + left + '개)' : '');
    return call + pick(NIGHT);
  }

  root.TodoNotify = { HOURS, wxKind, weatherTips, buildMessage };
})(typeof self !== 'undefined' ? self : this);
