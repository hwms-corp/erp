-- ============================================================
-- 006_seed.sql
-- 초기 데이터 (당사 정보)
-- ============================================================

INSERT INTO company (id, name, biz_no, rep, addr, tel, fax)
VALUES (
    1,
    '해원마린서비스 주식회사',
    '759-88-03427',
    '강경민',
    '부산광역시 사상구 괘감로 37, 11동 1층 111, 211호(괘법동, 산업용품유통상가)',
    '051-319-3010',
    '051-319-3020'
)
ON CONFLICT (id) DO UPDATE SET
    name   = EXCLUDED.name,
    biz_no = EXCLUDED.biz_no,
    rep    = EXCLUDED.rep,
    addr   = EXCLUDED.addr,
    tel    = EXCLUDED.tel,
    fax    = EXCLUDED.fax;
