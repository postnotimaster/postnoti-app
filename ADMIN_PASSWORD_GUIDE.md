# 관리자 비밀번호 강제 변경 가이드 (Supabase SQL)

관리자가 앱 내에서 비밀번호를 분실했거나, 보안상 즉시 비밀번호를 변경해야 할 경우 Supabase 대시보드에서 SQL을 이용해 강제로 비밀번호를 변경하는 방법입니다.

## 📌 변경 방법

1. **Supabase 대시보드**에 접속합니다.
2. 왼쪽 메뉴에서 **SQL Editor** (기호: `>_`) 를 클릭합니다.
3. **[+ New query]** 를 눌러 새 쿼리 창을 엽니다.
4. 아래의 코드를 복사하여 붙여넣고, `여기에_새로운_비밀번호_입력`과 `여기에_가입하신_이메일_입력` 부분을 실제 변경할 값으로 수정합니다.

```sql
-- 관리자 비밀번호 강제 변경 SQL
UPDATE auth.users 
SET encrypted_password = extensions.crypt('여기에_새로운_비밀번호_입력', extensions.gen_salt('bf')) 
WHERE email = '여기에_가입하신_이메일_입력';
```

### 💡 작성 예시
만약 아이디가 `admin@postnoti.com`이고, 새 비밀번호를 `postnoti1234!`로 변경하고 싶다면 아래와 같이 작성합니다.

```sql
UPDATE auth.users 
SET encrypted_password = extensions.crypt('postnoti1234!', extensions.gen_salt('bf')) 
WHERE email = 'admin@postnoti.com';
```

5. 우측 하단의 초록색 **[RUN]** 버튼을 클릭하면, 즉시 비밀번호가 새롭게 덮어씌워집니다.
6. 이제 앱에서 변경된 새 비밀번호로 다시 로그인하실 수 있습니다.
