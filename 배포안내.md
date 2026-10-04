# 나만의 학교 일정 To Do List — 구글 버전 ver1.02

첨부한 Supabase ver1.23를 바탕으로 만들었습니다. 일정, 검색·필터, 캘린더, 음력·반복, 공유 복사, 메모장 자동저장, 여러 시간표와 날짜별 세부사항 기능을 유지합니다. 로그인과 저장은 Google 계정과 본인의 Google Drive를 사용합니다. Supabase, Vercel, 별도 데이터베이스는 필요 없습니다.

## ver1.02 변경 사항

- 시간표 설정에서 시간표 복사 오른쪽에 삭제 버튼을 추가했습니다.
- ‘편집할 시간표’에서 고른 시간표만 삭제합니다. 확인창에서 확인하면 즉시 저장되며 설정 취소로 되돌릴 수 없습니다.
- 선택한 시간표의 교시·과목·색상과 모든 날짜의 세부사항 파일도 삭제합니다. 다른 시간표와 해당 기록은 유지합니다.
- 표시 중인 시간표를 삭제하면 남은 시간표를 표시하고, 마지막 시간표를 삭제하면 빈 기본 시간표를 만듭니다.
- Google Drive에는 여러 파일을 하나의 데이터베이스 트랜잭션으로 삭제하는 기능이 없습니다. 먼저 시간표 삭제와 삭제한 행 정보를 저장한 뒤 관련 세부사항 파일을 정리합니다. 중간에 연결이 끊겨도 삭제된 시간표와 기록이 다시 표시되지 않습니다. 정리가 남으면 안내와 재시도 버튼이 표시되며 시간표를 다시 열 때도 정리를 재시도합니다. 정리 안내가 사라져야 실제 관련 파일 삭제까지 끝난 상태입니다.
- Google ver1.01 사용자는 기존 config.js의 Client ID와 선택적 Calendar API 키를 새 배포본에 그대로 옮기세요. 같은 Google Cloud 프로젝트·구글 계정을 유지하면 기존 Drive 데이터를 사용합니다.

## 반드시 알아둘 로그인 동작

- 같은 앱 주소·같은 브라우저에서는 로그인 정보를 기억합니다. 브라우저를 닫거나 컴퓨터를 껐다 켜도 로그아웃을 누르기 전까지 이전 계정을 복원합니다.
- Google API 접속 토큰은 유효 시간이 있습니다. 아직 유효하면 별도의 구글 창을 열지 않고 연결합니다. 만료되면 이전 계정으로 다시 연결을 시도합니다.
- 자동 연결은 구글 세션, 승인 상태, 팝업 차단 정책에 따라 실패할 수 있습니다. 이 경우 앱은 계정 정보를 유지하며 **구글 다시 연결** 버튼을 표시합니다. 버튼을 눌러 연결하면 대기하던 읽기·저장 작업이 이어집니다. 다른 계정이 선택되면 기존 계정의 작업을 그 계정에 저장하지 못하도록 막습니다.
- **GitHub Pages만으로 '영원히 한 번도 재인증하지 않는 로그인'은 보장할 수 없습니다.** 장기간 사용할 수 있는 refresh token을 비밀 키 없이 안전하게 교환하는 서버가 이 배포 방식에는 없습니다. 만료된 토큰의 유효 시간을 임의로 늘려 저장하는 방식은 사용하지 않습니다.
- 앱 로그아웃은 이 앱에 저장된 계정과 토큰을 삭제하고, 가능한 경우 구글 앱 권한 해제를 요청합니다. 구글 전체 계정에서 로그아웃시키지는 않습니다. 권한 해제는 같은 앱을 사용 중인 다른 기기에도 영향을 줄 수 있습니다.
- 브라우저 저장소 삭제·시크릿 모드 종료·권한 철회·학교 계정 정책에 따라 다시 인증해야 합니다. 휴대전화 홈 화면 앱과 일반 브라우저의 저장소가 분리되는 환경에서는 처음 한 번 각각 연결해야 합니다.

## 1. 구글 설정

1. https://console.cloud.google.com/ 에 접속하여 사용할 프로젝트를 선택하거나 새로 만듭니다.
2. **API 및 서비스 → 라이브러리 → Google Drive API**를 검색하고 **사용**을 누릅니다.
3. **Google Auth Platform → Branding**에서 앱 이름(예: 나만의 학교 일정), 지원 이메일, 연락 이메일을 입력합니다. 아직 설정하지 않았다면 Get started부터 진행합니다.
4. **Audience**에서 사용 대상에 맞게 설정합니다. 개인 Gmail 계정이나 학교 밖 계정도 쓴다면 External을 선택합니다. Testing 상태라면 **Test users**에 사용할 구글 이메일을 추가합니다. 학교 계정은 관리자 정책으로 외부 앱이 차단될 수 있습니다.
5. **Data Access → Add or remove scopes**에서 다음 범위를 등록합니다.
   - `openid`
   - `https://www.googleapis.com/auth/userinfo.email`
   - `https://www.googleapis.com/auth/userinfo.profile`
   - `https://www.googleapis.com/auth/drive.appdata`
6. **Clients → Create client → Web application**을 선택합니다.
7. **Authorized JavaScript origins**에 GitHub Pages의 기본 도메인을 입력합니다.
   - 앱 주소가 `https://사용자명.github.io/저장소명/`이면 등록할 값은 **`https://사용자명.github.io`** 입니다.
   - `/저장소명/` 같은 경로는 여기에 붙이지 않습니다.
   - 사용자 지정 도메인을 쓰면 그 도메인의 HTTPS origin을 추가합니다.
   - 로컬 개발을 하려면 `http://localhost:5173`도 추가합니다.
8. **Client ID**를 복사합니다. 이 버전은 Google Identity Services의 브라우저 토큰 방식을 사용하므로 Client secret이나 서버용 callback 설정이 필요 없습니다.
9. 배포용 폴더의 **config.js**에서 아래 값을 실제 Client ID로 바꿉니다.

```javascript
window.SCHOOL_TODO_GOOGLE_CONFIG = {
  clientId: '실제_CLIENT_ID.apps.googleusercontent.com',
  calendarApiKey: '',
  holidayCalendarId: 'ko.south_korea#holiday@group.v.calendar.google.com'
};
```

Client ID는 공개용 식별자입니다. Client secret, 구글 비밀번호, 접속 토큰, Supabase secret key는 파일이나 GitHub에 넣지 마세요. 이 파일에는 실제 연결 정보가 들어 있지 않으므로 Client ID 설정 전에는 로그인할 수 없습니다.

## 2. GitHub Pages에 바로 올리기 — 권장

이 압축 파일의 최상위에는 **이미 빌드한 정적 배포본**이 들어 있습니다. Node.js나 Vercel 없이 사용할 수 있습니다.

1. 압축을 풉니다.
2. 위 안내대로 최상위 `config.js`에 Client ID를 입력합니다.
3. GitHub 저장소에 **index.html, config.js, assets 폴더, icon.svg, manifest.webmanifest**를 같은 최상위 위치로 올립니다. `.nojekyll`도 가능하면 함께 올립니다. `개발소스` 폴더와 안내 문서는 앱 실행에 필수는 아닙니다.
4. ZIP 자체를 업로드하지 마세요. 압축을 푼 폴더 자체가 한 단계 위에 추가되지 않도록 **index.html이 저장소 최상위에 있는지** 확인하세요.
5. GitHub **Settings → Pages**로 들어갑니다.
6. Source: **Deploy from a branch**
7. Branch: **main**, Folder: **/(root)** → **Save**
8. 배포가 끝나면 `https://사용자명.github.io/저장소명/` 주소로 접속합니다. 구글 설정에 넣은 origin과 실제 사이트 도메인이 같아야 합니다.
9. **구글 계정으로 로그인**을 눌러 앱 데이터 저장 권한을 승인합니다.
10. 일정을 하나 저장하고 새로고침해 남아 있는지 확인합니다. 브라우저를 닫았다 다시 열어 로그인 복원을 확인하고, 마지막으로 로그아웃 뒤 다시 열었을 때 계정 선택 화면으로 돌아가는지 확인합니다.

정적 배포본의 config.js는 빌드 결과와 분리되어 있으므로 GitHub에서 이 파일만 수정·커밋해도 연결 설정이 반영됩니다. 주소는 `file://`로 파일을 직접 여는 방식이 아니라 GitHub Pages의 HTTPS 주소를 사용하세요.

## 3. 공휴일 표시 — 선택 사항

기존 Supabase 버전은 서버가 공공데이터포털 API를 호출했습니다. GitHub Pages에는 그 서버가 없으므로 이 버전은 **구글의 공개 대한민국 공휴일 캘린더**로 전환했습니다.

1. 구글 프로젝트에서 **Google Calendar API**를 사용 설정합니다.
2. **API 및 서비스 → 사용자 인증 정보 → API 키 만들기**를 선택합니다.
3. 키의 애플리케이션 제한은 **웹사이트(HTTP referrers)**로 설정하고 `https://사용자명.github.io/*`를 추가합니다.
4. API 제한은 **Google Calendar API**만 허용합니다.
5. config.js의 `calendarApiKey`에 이 제한된 키를 입력합니다.

이 키는 공개 캘린더 읽기용이며 브라우저에서 보입니다. 공개 캘린더만 조회하므로 개인 캘린더 접근 권한은 요청하지 않습니다. 키가 없으면 일정 캘린더는 계속 작동하지만 공휴일 자동 표시는 꺼지고 설정 안내가 표시됩니다. 구글 자료의 설명에서 공휴일로 명시된 항목만 표시하고 기념일은 제외합니다. 기존 한국천문연구원 API와 제공 시점·명칭·분류가 다를 수 있으므로 학교 운영 일정은 실제 공휴일을 별도 확인하세요.

## 데이터 저장과 백업

- 각 사용자의 Google Drive **앱 데이터 공간(appDataFolder)**에 저장합니다. 개발자 Drive나 GitHub 저장소에 사용자 일정을 저장하지 않습니다.
- 이 공간은 일반 '내 드라이브' 파일 목록에는 보이지 않습니다. 같은 Google Cloud 프로젝트의 앱과 같은 구글 계정으로 로그인하면 다른 기기에서도 불러옵니다. 다른 구글 계정은 별도의 데이터 공간을 사용합니다.
- 필요한 권한은 앱 전용 데이터 공간과 계정 식별 정보입니다. 일반 Drive 파일 전체를 읽는 권한은 요청하지 않습니다.
- 일정·분야·메모·시간표·세부사항을 항목별 JSON으로 저장합니다. 서로 다른 항목을 수정할 때 전체 데이터를 덮어쓰지 않습니다. 같은 항목을 여러 기기에서 동시에 수정하면 마지막 저장이 반영될 수 있습니다. 다른 기기의 변경은 해당 화면을 다시 열거나 새로고침해서 확인하세요.
- Drive는 데이터베이스가 아니어서 항목이 많으면 조회·가져오기가 느려질 수 있고 Google 요청 할당량이 적용됩니다. 대량 가져오기는 일부 항목만 저장된 뒤 실패할 수 있습니다. 같은 파일로 다시 가져오면 이미 저장한 항목은 건너뜁니다.
- 인터넷 연결과 유효한 구글 권한이 있어야 데이터를 조회·저장합니다. 이 버전은 완전한 오프라인 앱이 아닙니다. 메모의 저장 전 임시 내용은 기기 저장소에도 남겨 재시도를 돕습니다. 저장 표시가 '저장됨'인지 확인한 뒤 종료하세요.
- 설정의 **전체 JSON 백업**은 일정, 분야 색상, 메모장, 시간표, 시간표 세부사항을 함께 내보냅니다.
- 전체 JSON 복원은 기존 같은 식별자의 항목을 유지하고 없는 항목을 추가합니다. 기존 분야와 같은 이름이 있으면 그 분야로 연결합니다. 기존 시간표가 있으면 복원본의 시간표 설정으로 덮어쓰지 않으므로, 기존 설정에 없는 행의 세부사항은 화면에 보이지 않을 수 있습니다.
- 기존 Supabase 버전에서 내보낸 `school-todo-v1` 형식의 JSON과 Google 시트 CSV도 가져올 수 있습니다. **기존 Supabase 데이터가 자동으로 이동하지는 않습니다.** 기존 버전의 JSON은 일정·분야만 포함하므로 그 백업만으로는 메모장·시간표가 이전되지 않습니다.
- 로그아웃해도 Drive 데이터는 삭제하지 않습니다. 다음 로그인 때 다시 조회합니다.

## 개발 소스를 수정할 때

`개발소스` 폴더에 Vite 원본과 테스트를 넣었습니다.

1. 그 폴더 안에서 `npm ci`를 실행합니다.
2. 소스 설정 파일은 `public/config.js`입니다.
3. `npm run dev`로 개발 서버를 열고 `npm test`, `npm run check`, `npm run build`로 확인합니다.
4. 새 `dist` 폴더의 내용으로 GitHub 저장소의 정적 배포 파일을 교체합니다. 최상위 config.js에 등록한 Client ID도 소스의 public/config.js에 넣고 빌드해야 합니다.
5. 원본 소스만 업로드해 GitHub Actions로 빌드하려는 경우 `개발소스` 안의 파일 전체(.github 포함)를 별도 저장소 최상위에 올리고 Settings → Pages → Source를 GitHub Actions로 선택합니다. 정적 배포본을 올리는 앞의 방법과 구분하세요.

## 검증 범위

자동 테스트 48개와 빌드된 앱의 DOM 실행 검사에서 로그인 복원·토큰 만료·계정 혼동 차단·Drive CRUD·전체 백업 복원과 기존 일정·시간표 기능을 확인했습니다. 구글 서비스는 모의 응답으로 검사했습니다. 실제 Google OAuth 클라이언트, 학교 계정 정책, 실제 Drive API 연결은 본인의 Client ID를 등록하여 배포한 뒤 확인해야 합니다.

참고 문서:
- https://developers.google.com/identity/oauth2/web/guides/use-token-model
- https://developers.google.com/identity/oauth2/web/reference/js-reference
- https://developers.google.com/workspace/drive/api/guides/appdata
- https://developers.google.com/workspace/guides/configure-oauth-consent
- https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site

Google ver1.02 · made by yoonsungho
