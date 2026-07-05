# neureps.com

주식회사 뉴렙스(Neureps Inc.) 회사 웹사이트. D-U-N-S 발급 → Apple/Google 개발자 등록 → 애드몹 수익화 단계를 모두 지원하도록 설계된 정적 사이트입니다.

## 구조

```
index.html            홈 (원페이지: 소개 / 하는 일 / 앱 / 문의)
privacy/index.html    개인정보처리방침 (애드몹 고지 포함) → neureps.com/privacy/
support/index.html    앱 지원·문의 페이지 → neureps.com/support/
app-ads.txt           애드몹 인증 파일 (가입 후 pub- 라인 추가)
assets/               로고(투명 배경), 파비콘, 스타일시트
icon/                 원본 로고
```

## 배포 (Cloudflare Pages 기준)

1. 이 폴더를 GitHub 저장소에 푸시
2. Cloudflare Pages에서 저장소 연결, 빌드 설정 없음(정적 사이트), 배포
3. 도메인 `neureps.com` 구입 후 Pages 프로젝트에 커스텀 도메인으로 연결 (HTTPS 자동)
4. 도메인 이메일(`contact@neureps.com`) 개통 — Cloudflare Email Routing(무료 포워딩) 또는 Google Workspace

GitHub Pages, Vercel, Netlify 어디에 올려도 동일하게 동작합니다.

## 배포 후 체크리스트

- [ ] 푸터의 회사 정보(법인명·주소·번호)가 등기/사업자 서류와 글자 단위로 일치하는지 확인
- [ ] D-U-N-S 신청 시 웹사이트 주소로 `https://neureps.com` 기재
- [ ] 애드몹 가입 후 `app-ads.txt`에 발급받은 `google.com, pub-…` 라인 추가
- [ ] 앱 스토어 등록 시 개발자 웹사이트: `https://neureps.com`, 지원 URL: `https://neureps.com/support/`, 개인정보처리방침 URL: `https://neureps.com/privacy/`
