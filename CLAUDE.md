# Apeach 공주 투두

- 앱 본체: `princess-todo.html`
- 로컬 DB: `db.js` — Dexie.js로 IndexedDB `princessTodo` 사용 (todos / hearts(날짜별) / cache(날씨) / diaries(날짜별 일기) / settings(profile: 이름·생년월일))
- 화면: 한 HTML 안에 page-home / add / done / diary / settings, 주소 #해시로 전환. 각 화면은 100dvh 한 화면(페이지 스크롤 없음), 목록·일기만 안에서 스크롤. 기준 iPhone 15/16 (393×852). 서버 저장 없음.
- 라이브러리(CDN): Dexie 4.0.8, FullCalendar 6.1.15 (2주 달력)
- 날씨: 브라우저 위치 → Open-Meteo API (키 없음), 1시간 캐시
- 로컬 실행: `python3 -m http.server 8080` → http://localhost:8080/princess-todo.html

## Git 규칙
- 요청 하나를 끝낼 때마다 바로 커밋한다. 커밋 메시지는 한국어로, 무엇을 바꿨는지 한 줄 요약.
- 커밋 후 바로 `git push` 해서 GitHub(https://github.com/A-peaches/todoApp)에 올린다.
