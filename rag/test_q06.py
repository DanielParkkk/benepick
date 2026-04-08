# -*- coding: utf-8 -*-
import sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8')
from pipeline import benepick_rag

result = benepick_rag('장애인 취업 지원 프로그램 알려줘', lang_code='ko')
if result['success']:
    print(result['data']['answer'])
