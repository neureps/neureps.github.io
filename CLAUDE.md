# CLAUDE.md

## LLM 위키 원천 선언 — `.wiki-sources.yml`

이 리포의 문서는 조직 LLM 위키 loom(`neureps/loom`)가 루트 [`.wiki-sources.yml`](.wiki-sources.yml)을
읽어 컴파일한다. 위키는 파생 계층이며 이 리포의 정본을 대체하지 않는다. 선언은 리포가
소유한다(분산 관리) — 위키 리포는 이 리포의 내부 구조를 알지 못하고 이 파일만 믿는다.

- ★ 문서(`*.md`)를 **추가·이동·개명·삭제·archive** 하는 커밋에서는 `.wiki-sources.yml`을
  **같은 커밋**에서 확인하고 필요하면 갱신한다. 문서를 옮기는 사람이 그 자리에서 고쳐야
  잊지 않는다 — 위키는 지난 ingest 이후의 git 변경분(`compare`)으로 이동·수정·삭제를
  알아내므로, 이 파일이 낡으면 과거 문서가 현재 사실로 컴파일된다.
- 분류는 셋이다. `canonical`(현재 상태·계약 — 사실로 컴파일) · `evidence`(경위·이력·실행
  기록 — 근거로만 인용) · `exclude`(읽지 않음). 우선순위는 exclude > evidence > canonical.
- 새 문서가 기존 glob에 이미 잡히면 파일 수정은 불필요하다. 다만 **분류가 맞는지는
  확인**한다 — 새 경위·이력·실행 기록 디렉터리가 생겼는데 `evidence`에 없으면 추가하고,
  완료·기각 문서는 `archive/` 아래로 옮겨 `exclude`에 걸리게 한다.
- 확인 명령: `python3 <loom 클론>/tooling/wiki-sources-check.py` — 분류 집계를 내고,
  경위로 보이는 디렉터리가 `canonical`에 잡히면 경고한다.
