# LabManager 鎴愬搧绾ф渶缁堟妧鏈灦鏋勬柟妗?

> Boundary note: 本文档描述的是目标生产架构与最终推荐栈，不是“当前仓库已经实现完成的真实状态”说明。判断当前已落地能力时，请优先参考 `docs/ai-executable-backlog.md` 与 `docs/project-sync-status.md`。
## 1. 鐩爣

鏈枃妗ｅ畾涔?LabManager 鍦ㄢ€滄渶缁堜氦浠樻垚鍝佲€濋樁娈电殑鎺ㄨ崘鎶€鏈灦鏋勶紝鐩爣鏄悓鏃舵弧瓒筹細

- 瀹為獙瀹ゆ棩甯镐笟鍔″彲绋冲畾浣跨敤
- AI 鍛樺伐涓婚摼璺彲鎸佺画婕旇繘
- Excel 瀵煎叆銆丳DF 鎶ュ憡銆侀偖浠舵姇閫掋€佸紓姝ュ贰妫€绛夎兘鍔涘叿澶囧伐绋嬪寲鍙淮鎶ゆ€?- 鍚庣画 P1 / P2 鑳藉姏鎵╁睍涓嶅弽澶嶆帹缈诲熀纭€璁炬柦

鏋舵瀯鍘熷垯锛?
- 鍓嶇缁х画娌跨敤鐜版湁 React + TypeScript 浣撶郴
- 鍚庣浠?Python 涓轰富鎵胯浇姝ｅ紡涓氬姟鏈嶅姟涓?AI 缂栨帓
- 鎵€鏈?AI 鍔ㄤ綔蹇呴』閫氳繃宸ュ叿灞傛墽琛?- 鎵€鏈夊叧閿姩浣滃繀椤诲彲杩借釜銆佸彲瀹¤銆佸彲鍥炴函
- 鍏堜繚璇佷富閾捐矾绋冲畾锛屽啀澧炲己鏅鸿兘鑳藉姏

---

## 2. 鎬讳綋鎺ㄨ崘鏍?
### 2.1 鏈€缁堟帹鑽?
- 鍓嶇锛歊eact + TypeScript + Vite + Tailwind CSS
- 涓诲悗绔細Python + FastAPI
- AI 缂栨帓锛歀angGraph锛圥ython锛?- 鏁版嵁搴擄細PostgreSQL
- 缂撳瓨 / 闃熷垪锛歊edis
- 寮傛璋冨害锛欳elery
- 鏂囦欢瀛樺偍锛氭湰鍦板璞″瓨鍌ㄦ帴鍙ｈ捣姝ワ紝鍚庣画鍙垏 S3 鍏煎瀛樺偍
- 閭欢鎶曢€掞細SMTP / 浼佷笟閭缃戝叧
- 閮ㄧ讲锛欴ocker Compose 璧锋锛孨ginx 鍙嶅悜浠ｇ悊

### 2.2 涓轰粈涔堣繖鏍烽€?
- 鍓嶇鐜版湁宸ョ▼宸茬粡鎴愮啛锛岀户缁部鐢ㄦ垚鏈渶浣?- Python 鏇撮€傚悎鎵挎帴 Excel銆丳DF銆侀偖浠躲€佷换鍔¤皟搴︺€丄I 缂栨帓
- LangGraph 鍦?Python 鐢熸€侀噷鎴愮啛搴︽洿楂橈紝涓?LLM 鍜屾暟鎹鐞嗕换鍔¤鎺ユ洿椤?- PostgreSQL 閫傚悎浠诲姟銆佸鎵广€佹棩蹇椼€侀厤缃€佹姤琛ㄣ€佸鍏ヨ褰曠瓑寮虹粨鏋勫寲鏁版嵁
- Redis + Celery 閫傚悎鏃ユ姤鍛ㄦ姤銆佸贰妫€銆侀噸璇曘€侀偖浠跺彂閫佺瓑鍚庡彴寮傛浠诲姟

---

## 3. 鍓嶇鏋舵瀯

### 3.1 鎶€鏈爤

- React 18
- TypeScript
- Vite
- Tailwind CSS
- React Router

### 3.2 鍓嶇鑱岃矗

- 灞曠ず涓氬姟椤甸潰涓?AI 椤甸潰
- 鎻愪緵琛ㄥ崟褰曞叆銆佸鍏ュ叆鍙ｃ€佷换鍔″鐞嗐€佸鎵规搷浣滃叆鍙?- 鎵挎媴椤甸潰绾х姸鎬佷笌浜や簰閫昏緫
- 璋冪敤鍚庣 REST API / SSE / 杞鎺ュ彛鑾峰彇鐪熷疄鏁版嵁
- 涓嶆壙鎷呰鍒欏垽鏂€佸垽閲嶃€佸鎵归棬绂併€侀偖浠跺彂閫併€佹姤琛ㄧ敓鎴愮瓑鏈嶅姟绔亴璐?
### 3.3 寤鸿鍓嶇妯″潡

- `src/pages/`
  - Dashboard / AlertCenter / ChemicalInventory / EquipmentManagement / MaintenanceRecords
  - AIDashboard / AITaskCenter / AIApprovals / AIReports / AIAnalysis
- `src/features/ai/`
  - 浠诲姟銆佸鎵广€佹姤鍛娿€佷簨浠舵煡璇?hooks
  - API client
  - 鍓嶇灞曠ず鍨?selectors
- `src/features/settings/`
  - 闃堝€笺€佸鎵圭瓥鐣ャ€丼LA銆侀€氱煡閰嶇疆椤甸潰
- `src/components/`
  - 琛ㄦ牸銆佹娊灞夈€佽鎯呭崱鐗囥€佺姸鎬佹爣绛俱€佸鍏ョ粨鏋滄彁绀恒€佹姤鍛婅鎯呰鍥?
### 3.4 鍓嶇杈圭晫

- 鍓嶇鍙秷璐瑰悗绔繑鍥炵殑 DTO
- 鍓嶇涓嶅畾涔夋柊鐨勪笟鍔＄湡鐩稿瓧娈?- 鍓嶇淇濈暀灏戦噺灞曠ず鍨嬫槧灏勶紝濡傜姸鎬佹枃妗堛€侀鑹叉牱寮?- 鍓嶇涓嶇洿鎺ュ疄鐜板垽閲嶄笌鐘舵€佹満瑙勫垯

---

## 4. 鍚庣鏋舵瀯

## 4.1 鎶€鏈爤

- Python 3.11+
- FastAPI
- Pydantic
- SQLAlchemy 2.x / SQLModel
- Alembic

## 4.2 鍚庣鑱岃矗

- 鎵胯浇浠诲姟銆佸鎵广€佹棩蹇椼€侀厤缃€佹姤鍛娿€佸鍏ヨ褰曠瓑鏍稿績涓氬姟鏈嶅姟
- 鎻愪緵 REST API
- 缁熶竴鏍￠獙 DTO銆佺姸鎬佹満銆佹潈闄愰棬绂併€佸垽閲嶉€昏緫
- 绠＄悊鏂囦欢瀵煎叆銆丳DF 鐢熸垚銆侀偖浠跺彂閫併€佸紓姝ヤ换鍔?- 涓?LangGraph 鎻愪緵宸ュ叿灞備笌涓婁笅鏂囨煡璇㈣兘鍔?
## 4.3 鍚庣妯″潡寤鸿

- `app/api/`
  - `tasks.py`
  - `approvals.py`
  - `reports.py`
  - `imports.py`
  - `settings.py`
  - `notifications.py`
- `app/domain/`
  - 浠诲姟鐘舵€佹満
  - 瀹℃壒鐘舵€佹満
  - 鍒ら噸瑙勫垯
  - SLA 瑙勫垯
- `app/services/`
  - 浠诲姟鏈嶅姟
  - 瀹℃壒鏈嶅姟
  - 鎶ュ憡鏈嶅姟
  - 瀵煎叆鏈嶅姟
  - 閫氱煡鏈嶅姟
  - 閭欢鏈嶅姟
- `app/repositories/`
  - 浠诲姟浠撳偍
  - 瀹℃壒浠撳偍
  - 鏃ュ織浠撳偍
  - 閰嶇疆浠撳偍
  - 鎶ュ憡浠撳偍
- `app/contracts/`
  - 涓庡墠绔€佽鍒欏眰銆丩angGraph 鍏辩敤鐨?DTO
- `app/ai/`
  - 瑙勫垯寮曟搸
  - LangGraph graph
  - 宸ュ叿灞?
## 4.4 API 褰㈡€佸缓璁?
- REST 涓轰富
- 瀵归暱鑰楁椂浠诲姟杩斿洖浠诲姟鐘舵€佹垨鍚庡彴 job id
- 瀵归┚椹跺彴鎽樿銆佹姤鍛婄敓鎴愮姸鎬併€侀€氱煡鐘舵€佸彲琛ュ厖杞鎴?SSE

---

## 5. AI 鏋舵瀯

## 5.1 鎶€鏈爤

- LangGraph锛圥ython锛?- LLM SDK
- 妯℃澘鍖栨彁绀鸿瘝 + 缁撴瀯鍖栬緭鍑?
## 5.2 AI 鍒嗗眰

### 瑙勫垯灞?
- 浣庡簱瀛樿瘑鍒?- 瓒呮湡缁存姢璇嗗埆
- 寮傚父璁惧璇嗗埆
- 鍒ら噸
- 瀹℃壒闂ㄧ
- SLA

璇存槑锛?
- 蹇呴』鏄函浠ｇ爜瀹炵幇
- 涓嶇敱 LLM 鍐冲畾

### 鍥剧紪鎺掑眰

- Event Ingestor
- Normalize Event
- Rule Gate
- Supervisor Router
- Inventory Handler
- Maintenance Handler
- Fault Handler
- Recommendation Builder
- Approval Gate
- Create / Update Task
- Create Approval
- Write Activity Log

### 璇箟灞?
- 浠诲姟鍘熷洜璇存槑
- 椋庨櫓鎽樿
- 寤鸿鍔ㄤ綔鎽樿
- 鎶ュ憡鎽樿

璇存槑锛?
- 浠呭湪涓嶅奖鍝嶇‘瀹氭€ф墽琛岀殑鑺傜偣浣跨敤 LLM
- 杈撳嚭蹇呴』鏄粨鏋勫寲鍙璁″唴瀹?
## 5.3 AI 杈圭晫

- Agent 涓嶇洿鎺ュ啓鏁版嵁搴?- Agent 涓嶇洿鎺ュ喅瀹氭潈闄愩€佸鎵归棬绂併€佸垽閲?- Agent 閫氳繃宸ュ叿灞傝皟鐢ㄤ笟鍔℃湇鍔?- 姣忔鍥炬墽琛屽繀椤婚檮甯?`runId`

---

## 6. 鏁版嵁搴撴灦鏋?
## 6.1 涓绘暟鎹簱

- PostgreSQL

## 6.2 鏍稿績琛?
- `ai_tasks`
- `ai_task_actions`
- `approvals`
- `ai_memories`
- `ai_reports`
- `import_jobs`
- `import_job_errors`
- `system_settings`
- `notification_deliveries`
- `report_deliveries`

## 6.3 鏁版嵁璁捐鍘熷垯

- 寮虹粨鏋勫寲瀛楁浼樺厛钀藉垪
- 鎵╁睍瀛楁鏀?`metadata` JSONB
- 浠诲姟銆佸鎵广€佹棩蹇椾笁绫诲璞″繀椤诲己鍏宠仈
- 瀵煎叆璁板綍銆佸彂閫佽褰曘€佸け璐ラ噸璇曢兘蹇呴』鐣欑棔

## 6.4 鎺ㄨ崘琛ュ厖瀛楁

### `import_jobs`

- `id`
- `source_type`
- `uploaded_by`
- `uploaded_at`
- `status`
- `success_count`
- `error_count`
- `file_path`

### `report_deliveries`

- `id`
- `report_id`
- `recipient_email`
- `recipient_role`
- `delivery_status`
- `sent_at`
- `retry_count`
- `error_message`

---

## 7. 璋冨害涓庡紓姝ヤ换鍔?
## 7.1 鎶€鏈爤

- Redis
- Celery
- Celery Beat

## 7.2 閫傚悎寮傛鍖栫殑浠诲姟

- 瀹氭椂宸℃鐢熸垚浜嬩欢
- 鏃ユ姤 / 鍛ㄦ姤 / 鏈堟姤鐢熸垚
- PDF 鐢熸垚
- 閭欢鍙戦€?- 澶辫触閲嶈瘯
- 澶ф壒閲?Excel 瀵煎叆

## 7.3 璋冨害绛栫暐

- 宸℃浠诲姟锛氬浐瀹氶鐜?- 鎶ュ憡浠诲姟锛氭棩鎶?/ 鍛ㄦ姤 / 鏈堟姤璁″垝浠诲姟
- 閭欢澶辫触浠诲姟锛氭寚鏁伴€€閬块噸璇?- 瀵煎叆浠诲姟锛氫笂浼犲悗寮傛澶勭悊锛屽墠绔疆璇㈢粨鏋?
---

## 8. 鏂囦欢鏋舵瀯

## 8.1 鏂囦欢绫诲瀷

- Excel 瀵煎叆鏂囦欢
- 瀵煎叆閿欒娓呭崟
- 璁惧鍥剧墖 / 鍖栧鍝佸浘鐗?- PDF 鎶ュ憡

## 8.2 澶勭悊鏂瑰紡

- 鍏冩暟鎹叆搴?- 鏂囦欢瀛樺璞″瓨鍌?- 鏁版嵁搴撲粎璁板綍璺緞銆佸ぇ灏忋€佸搱甯屻€佷笂浼犳椂闂淬€佸叧鑱斿璞?
## 8.3 寤鸿鏂规

- 鏈湴寮€鍙戯細鏈湴鏂囦欢绯荤粺
- 鎴愬搧閮ㄧ讲锛歋3 鍏煎瀵硅薄瀛樺偍鎴?MinIO

---

## 9. 閭欢鏋舵瀯

## 9.1 鑱岃矗

- 鍙戦€佹棩鎶?/ 鍛ㄦ姤 / 鏈堟姤 PDF
- 鍙戦€佸鎵规彁閱掋€佽秴鏃跺偓鍔炪€佸崌绾ч€氱煡
- 璁板綍鎶曢€掔粨鏋溿€佸け璐ュ師鍥犮€侀噸璇曟鏁?
## 9.2 鎺ㄨ崘缁勪欢

- 閭欢鏈嶅姟閫傞厤灞?- 妯℃澘娓叉煋灞?- 鎶曢€掕褰曚粨鍌?- 澶辫触閲嶈瘯浠诲姟

## 9.3 鏍稿績娴佺▼

1. 鐢熸垚鎶ュ憡
2. 娓叉煋 PDF
3. 鏍规嵁瀹為獙瀹?/ 閮ㄩ棬 / 璐ｄ换鑼冨洿鍖归厤涓荤
4. 鍙戦€侀偖浠?5. 璁板綍鍙戦€佺粨鏋?6. 澶辫触鏃惰繘鍏ラ噸璇曚笌鍛婅

---

## 10. 閮ㄧ讲鏋舵瀯

## 10.1 璧锋鏂规

- Nginx
- 鍓嶇闈欐€佽祫婧?- FastAPI 鏈嶅姟
- PostgreSQL
- Redis
- Celery Worker
- Celery Beat
- 瀵硅薄瀛樺偍

## 10.2 鎺ㄨ崘閮ㄧ讲鏂瑰紡

- Docker Compose 璧锋
- 姣忎釜鏈嶅姟鐙珛瀹瑰櫒
- `.env` 绠＄悊鏁版嵁搴撱€丷edis銆丼MTP銆佸璞″瓨鍌ㄩ厤缃?
## 10.3 鐜鍒嗗眰

- 鏈湴寮€鍙戠幆澧?- 娴嬭瘯 / 棰勫彂甯冪幆澧?- 鐢熶骇鐜

---

## 11. 瀹夊叏涓庡璁?
## 11.1 瀹夊叏

- 鍩轰簬瑙掕壊鐨勬潈闄愭帶鍒?- 瀹℃壒鍔ㄤ綔蹇呴』楠屾潈
- 瀵煎叆銆佸鍑恒€佸彂閫侀偖浠跺繀椤昏褰曟搷浣滆€?- 閰嶇疆鍙樻洿瑕佺暀瀹¤鏃ュ織

## 11.2 瀹¤

- 鎵€鏈変换鍔＄姸鎬佸彉鍖栫暀鐥?- 鎵€鏈夊鎵圭暀鐥?- 鎵€鏈夐偖浠舵姇閫掔暀鐥?- 鎵€鏈夊鍏ユ壒娆＄暀鐥?- 鎵€鏈夊浘鎵ц淇濈暀 `runId`

---

## 12. 寮€鍙戦樁娈佃縼绉昏矾寰?
## 12.1 褰撳墠闃舵

- 鍓嶇锛歊eact + TypeScript 宸插彲缁х画娌跨敤
- 鍚庣锛氬綋鍓?TS 棰嗗煙灞傚彲缁х画浣滀负妯″瀷銆佸崗璁€佹祦绋嬪師鍨?
## 12.2 鐩爣闃舵

- 鏈€缁堜富鍚庣杩佸埌 Python + FastAPI
- LangGraph 鐪熷疄杩愯鏃舵斁鍦?Python 渚?- TS 鍚庣閫愭閫€涓哄弬鑰冨疄鐜版垨琚畬鍏ㄦ浛鎹?
## 12.3 杩佺Щ鍘熷垯

- 鍏堣縼鏂板鑳藉姏锛屼笉鍏堥噸鍐欐墍鏈夊凡鏈夎兘鍔?- 鍏堣縼瑙勫垯鏈嶅姟銆佸鍏ャ€佹姤鍛娿€侀偖浠躲€佸紓姝ヤ换鍔?- 鏈€鍚庤縼浠诲姟 / 瀹℃壒涓?API

---

## 13. 鏈€缁堢粨璁?
濡傛灉鐩爣鏄氦浠樷€滅湡姝ｅ彲涓婄嚎鐨勬垚鍝佲€濓紝鏈€鎺ㄨ崘鐨勬渶缁堢粍鍚堟槸锛?
- 鍓嶇锛歊eact + TypeScript
- 鍚庣锛歅ython + FastAPI
- AI锛歀angGraph锛圥ython锛?- 鏁版嵁搴擄細PostgreSQL
- 寮傛锛歊edis + Celery
- 鏂囦欢锛氬璞″瓨鍌?- 閭欢锛歋MTP / 浼佷笟閭缃戝叧
- 閮ㄧ讲锛欴ocker Compose + Nginx

杩欏鏂规鏈€閫傚悎浣犱滑杩欎釜椤圭洰鐨勭湡瀹炵粓灞€锛氭棦鏈変笟鍔＄鐞嗙郴缁燂紝鍙堟湁 AI 缂栨帓銆佸鍏ャ€佹姤琛ㄣ€侀偖浠跺拰鍚庡彴浠诲姟銆?