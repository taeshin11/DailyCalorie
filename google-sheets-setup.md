# Google Sheets 데이터 수집 설정 가이드

## 1단계: Google Sheets 만들기
1. https://sheets.google.com 에서 새 스프레드시트 만들기
2. 시트 이름을 "TDEE Data"로 변경
3. 첫 번째 행에 헤더 입력:
   | A | B | C | D | E | F | G | H | I | J |
   |---|---|---|---|---|---|---|---|---|---|
   | Timestamp | Gender | Age | Weight_kg | Height_cm | Activity | BMR | TDEE | Diet | Unit |

## 2단계: Google Apps Script 설정
1. 스프레드시트에서 메뉴 > 확장 프로그램 > Apps Script 클릭
2. 기존 코드 전부 삭제하고 아래 코드 붙여넣기:

```javascript
function doPost(e) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  var data = JSON.parse(e.postData.contents);

  sheet.appendRow([
    data.timestamp || new Date().toISOString(),
    data.gender || "",
    data.age || "",
    data.weight_kg || "",
    data.height_cm || "",
    data.activity || "",
    data.bmr || "",
    data.tdee || "",
    data.diet || "",
    data.unit || ""
  ]);

  return ContentService.createTextOutput("OK");
}
```

3. 저장 (Ctrl+S)

## 3단계: 웹 앱으로 배포
1. 배포 > 새 배포 클릭
2. 유형: "웹 앱" 선택
3. 실행 사용자: "나" (본인 계정)
4. 액세스 권한: "모든 사용자" (Anyone)
5. 배포 클릭 → 권한 승인
6. **웹 앱 URL 복사** (https://script.google.com/macros/s/xxxxx/exec 형태)

## 4단계: 코드에 URL 넣기
app.js 파일 맨 위의:
```javascript
const GOOGLE_SHEETS_WEBHOOK_URL = "";
```
를 복사한 URL로 변경:
```javascript
const GOOGLE_SHEETS_WEBHOOK_URL = "https://script.google.com/macros/s/여기에_URL/exec";
```

이후 사용자가 TDEE를 계산할 때마다 자동으로 Google Sheets에 데이터가 저장됩니다.
