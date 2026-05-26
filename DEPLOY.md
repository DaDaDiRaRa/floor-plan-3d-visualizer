# 배포 가이드 — Floor Plan 3D Visualizer

## 아키텍처 요약

단일 컨테이너 구조. Express가 React 빌드 결과물(`dist/`)을 StaticFiles로 서빙하며, Gemini API 호출을 프록시하여 API 키를 서버에 안전하게 보관.

```
GitHub main 브랜치 push
  → GitHub Actions (deploy.yml)
    → Docker 빌드 (멀티스테이지: Node.js 빌드 → Node.js 이미지)
      → Artifact Registry push
        → Cloud Run 배포 (asia-northeast3)
```

---

## 1. 로컬 개발

터미널 2개 필요:

```bash
# 터미널 1: Express 백엔드 서버
cp .env.example .env
# .env 파일에 GEMINI_API_KEY=AIza... 입력
npm run dev:server
# → http://localhost:8080

# 터미널 2: Vite 프론트엔드 (자동으로 /api를 :8080으로 프록시)
npm run dev
# → http://localhost:3000
```

---

## 2. 로컬 Docker 통합 테스트

프로덕션과 동일한 단일 컨테이너 환경으로 검증.

```bash
cp .env.example .env
# .env 파일에 GEMINI_API_KEY=AIza... 입력

docker compose up --build
# → http://localhost:8080
```

---

## 3. 자동 배포 (권장)

`main` 브랜치에 push하면 GitHub Actions가 자동으로 빌드 → 배포.

```bash
git add .
git commit -m "변경사항 설명"
git push origin main
```

진행 상황: `https://github.com/DaDaDiRaRa/floor-plan-3d-visualizer/actions`

---

## 4. GCP 최초 설정 (최초 1회)

### 4-1. 프로젝트 및 API 활성화

```bash
gcloud config set project arch-diagnose

gcloud services enable \
  run.googleapis.com \
  artifactregistry.googleapis.com \
  cloudbuild.googleapis.com \
  secretmanager.googleapis.com
```

### 4-2. Artifact Registry 저장소 생성

```bash
gcloud artifacts repositories create floor-plan-3d \
  --repository-format=docker \
  --location=asia-northeast3
```

### 4-3. Secret Manager에 Gemini API Key 등록

```bash
# 이미 GEMINI_API_KEY 시크릿이 있으면 버전만 추가:
echo -n "AIza..." | gcloud secrets versions add GEMINI_API_KEY --data-file=-

# 없으면 새로 생성:
echo -n "AIza..." | gcloud secrets create GEMINI_API_KEY --data-file=-
```

### 4-4. Cloud Run 서비스 계정에 Secret 접근 권한 부여

sketch-2-render와 동일한 GCP 프로젝트를 사용하므로 이미 설정되어 있을 수 있음.
설정이 안 되어 있다면:

```bash
gcloud projects describe arch-diagnose --format="value(projectNumber)"
# → 예: 30350777436

gcloud projects add-iam-policy-binding arch-diagnose \
  --member="serviceAccount:<프로젝트번호>-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

### 4-5. GitHub Actions용 서비스 계정 키 등록

`github-actions-deployer@arch-diagnose.iam.gserviceaccount.com` 서비스 계정이 이미 있으면 기존 키 사용.
없으면:

```bash
gcloud iam service-accounts keys create key.json \
  --iam-account=github-actions-deployer@arch-diagnose.iam.gserviceaccount.com
```

`key.json` 내용을 GitHub → Settings → Secrets and variables → Actions → `GCP_SA_KEY`에 붙여넣기.
**발급 후 key.json은 즉시 삭제.**

```bash
del key.json
```

---

## 5. 환경변수 정리

| 위치 | 변수명 | 설명 |
|---|---|---|
| GCP Secret Manager | `GEMINI_API_KEY` | Gemini API 인증키 |
| GitHub Secrets | `GCP_SA_KEY` | 서비스 계정 JSON 전체 내용 |
| `.env` (로컬 전용) | `GEMINI_API_KEY` | 로컬 개발/Docker 테스트용 |

프로덕션(Cloud Run)에서 `GEMINI_API_KEY`는 Secret Manager에서 주입.

---

## 6. 배포 확인

```bash
# Cloud Run 서비스 URL 확인
gcloud run services describe floor-plan-3d-app \
  --region=asia-northeast3 \
  --format="value(status.url)"

# 헬스체크
curl https://<서비스-URL>/health
# → {"status":"ok"}
```

---

## 7. 트러블슈팅

| 증상 | 원인 | 해결 |
|---|---|---|
| GitHub Actions 인증 실패 | `GCP_SA_KEY` 시크릿이 비어있거나 잘못된 JSON | 서비스 계정 키 재발급 후 시크릿 재등록 |
| Secret Manager 권한 거부 | Compute 서비스 계정에 `secretAccessor` 미부여 | 4-4 단계 실행 |
| Artifact Registry 푸시 실패 | `floor-plan-3d` 저장소 미생성 | 4-2 단계 실행 |
| 컨테이너 빌드 실패 | TypeScript 컴파일 오류 | `npm run build:server`로 로컬 재현 후 디버깅 |
| API 호출 실패 (500) | Gemini API Key 만료 또는 미설정 | Secret Manager에서 키 버전 업데이트 |
| `dist` 폴더 없음 오류 | Vite 빌드 미실행 | Docker 빌드 시 자동 실행됨, 로컬은 `npm run build` |
