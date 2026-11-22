// CyberGuard AI 项目库：6 个功能，每个功能拆成可以在一个学习时段里完成的任务。
// 任务顺序即开发顺序；生成计划时取“第一个未完成”的任务，所以顺序不能随意打乱。

import type { ProjectFeature } from '../../domain/types'

export const PROJECT_FEATURES: ProjectFeature[] = [
  {
    id: 'f1-url',
    name: '1 · AI 钓鱼网站 URL 检测',
    goal: '输入一个 URL，输出可疑度分数和理由。先做特征 + 规则基线，后面再接模型。',
    tasks: [
      {
        id: 't1-1',
        featureId: 'f1-url',
        title: '搭仓库骨架 + README + requirements',
        steps: [
          '新建 GitHub 仓库 cyberguard-ai，勾选 Python .gitignore',
          '在本地建 venv，装 requests、pytest，写入 requirements.txt',
          '写 README：项目目标、当前进度、如何运行',
        ],
        deliverable: '仓库可 clone、能跑通 python -c "import requests"',
        minutes: 60,
      },
      {
        id: 't1-2',
        featureId: 'f1-url',
        title: '抓取 URL 基础特征（HTTP 层）',
        steps: [
          '用 requests 请求示例 URL，拿到状态码、响应头、HTML',
          '提取：URL 长度、是否 IP 直连、是否有 @、连字符数量、是否短链域名、HTTPS 是否有效',
          '结果输出成 dict 并打印，先用 3 个正常网站 + 3 个假 URL 试',
        ],
        deliverable: 'features.py 能对任意 URL 输出 7 个特征',
        minutes: 60,
      },
      {
        id: 't1-3',
        featureId: 'f1-url',
        title: '整理 20 条标注样本',
        steps: [
          '找 10 个已知钓鱼/仿冒 URL（PhishTank 公开列表即可），10 个正常 URL',
          '写成 CSV：url,label,note',
          '把样本放在 data/samples.csv，README 里说明来源与用途',
        ],
        deliverable: '20 行标注样本 CSV',
        minutes: 45,
      },
      {
        id: 't1-4',
        featureId: 'f1-url',
        title: '规则打分基线',
        steps: [
          '给每个特征定权重（例如 IP 直连 +30、@ +25、短链 +20）',
          '写 score(features) → 0-100，并输出触发了哪几条规则',
          '在 20 条样本上跑，记录准确率写进 README',
        ],
        deliverable: 'scorer.py + 一段准确率记录',
        minutes: 60,
      },
      {
        id: 't1-5',
        featureId: 'f1-url',
        title: '给检测器写 5 个单测',
        steps: [
          '用 pytest 测：IP 直连判可疑、正常 URL 分数低、缺协议、超长 URL、短链',
          '运行 pytest，全绿后提交',
          'CI 还没配的话先手动跑，下周补',
        ],
        deliverable: 'tests/test_scorer.py，5 个通过用例',
        minutes: 45,
      },
      {
        id: 't1-6',
        featureId: 'f1-url',
        title: 'README 写清方法与局限',
        steps: [
          '写“检测思路”一节：特征 → 权重 → 分数',
          '写“局限”一节：规则可被绕过、误报来源',
          '补 3 条后续改进（模型化、更多特征、实时情报）',
        ],
        deliverable: 'README 有方法+局限+下一步三节',
        minutes: 30,
      },
    ],
  },
  {
    id: 'f2-email',
    name: '2 · 钓鱼邮件分析',
    goal: '输入一封 .eml，输出发件人可疑点、正文可疑点、链接清单。',
    tasks: [
      {
        id: 't2-1',
        featureId: 'f2-email',
        title: '解析 .eml 提取头字段',
        steps: [
          '用 Python email 库读取 .eml，打印 From/Reply-To/Return-Path/Received',
          '提取所有 body 部分（text/plain 优先），拼成正文',
          '写 email_parser.py，返回结构化 dict',
        ],
        deliverable: 'parser 能解析 2 封真实邮件不报错',
        minutes: 60,
      },
      {
        id: 't2-2',
        featureId: 'f2-email',
        title: '域名一致性检测',
        steps: [
          '比较 From 显示名与真实域名、Reply-To 与 From 域名',
          '标出“显示名像银行但域名不是”的情况',
          '输出 suspicious_domains 列表 + 理由',
        ],
        deliverable: '3 类域名不一致都能被检出',
        minutes: 45,
      },
      {
        id: 't2-3',
        featureId: 'f2-email',
        title: '正文关键词 + 链接提取',
        steps: [
          '提取正文所有 URL，解析出最终域名',
          '匹配紧迫词（verify/urgent/24 hours/密码过期等），中文词也要覆盖',
          '输出 {keywords, links[]} 并打印',
        ],
        deliverable: '一封样例邮件能列出链接与命中词',
        minutes: 45,
      },
      {
        id: 't2-4',
        featureId: 'f2-email',
        title: '统一报告 JSON 结构',
        steps: [
          '定义 email_report：sender, domain_issues[], keywords[], links[], verdict',
          '让 parser 输出到该结构，写到 reports/',
          '用 json.loads 自检字段齐全',
        ],
        deliverable: '一份 email_report.json 示例',
        minutes: 45,
      },
      {
        id: 't2-5',
        featureId: 'f2-email',
        title: '10 封公开钓鱼邮件回归测试',
        steps: [
          '找 10 封公开钓鱼邮件样本（或自己造 10 封）',
          '批量跑分析，人工核对哪些漏报/误报',
          '把结果记到 tests/fixtures 与 README',
        ],
        deliverable: '10 封样本的检出率记录',
        minutes: 60,
      },
      {
        id: 't2-6',
        featureId: 'f2-email',
        title: '命令行入口 analyze-email',
        steps: [
          '写 cli.py：python cli.py email sample.eml',
          '支持 --json 输出，默认输出人话版结论',
          '写入 README 用法示例',
        ],
        deliverable: '一条命令能分析任意 .eml',
        minutes: 45,
      },
    ],
  },
  {
    id: 'f3-intel',
    name: '3 · 威胁情报 API 接入',
    goal: '把 URL/域名/IP 丢给 2 个免费情报源，汇总成统一结论。',
    tasks: [
      {
        id: 't3-1',
        featureId: 'f3-intel',
        title: '选 2 个免费情报源并注册 Key',
        steps: [
          '选 VirusTotal（免费额度）+ URLhaus 或 AbuseIPDB',
          '注册账号、拿到 API Key，写进 .env（不要提交）',
          '在 .env.example 里写变量名',
        ],
        deliverable: '.env 可用 + .env.example 已提交',
        minutes: 45,
      },
      {
        id: 't3-2',
        featureId: 'f3-intel',
        title: '封装 HTTP client（超时/重试/缓存）',
        steps: [
          '写 intel_client.py：requests.Session、10 秒超时、失败重试 1 次',
          '把结果缓存到 cache/（按域名+日期命名）',
          '断网时返回 last_error 而不是崩溃',
        ],
        deliverable: '断网调用不抛异常，返回错误结构',
        minutes: 60,
      },
      {
        id: 't3-3',
        featureId: 'f3-intel',
        title: '统一情报结果 schema',
        steps: [
          '定义 intel_result：source, malicious(bool), score, tags[], raw_ref',
          '两个源都映射到该结构',
          '写 1 个 mock 测试验证映射',
        ],
        deliverable: '2 个源输出同一种结构',
        minutes: 45,
      },
      {
        id: 't3-4',
        featureId: 'f3-intel',
        title: '批量查询 + 限速',
        steps: [
          '支持一次查多个域名，串行 + 间隔 1 秒（免费额度保护）',
          '打印进度，失败项单独列出',
          '跑 5 个域名验证',
        ],
        deliverable: '一次跑 5 个域名的脚本输出',
        minutes: 45,
      },
      {
        id: 't3-5',
        featureId: 'f3-intel',
        title: '情报合并规则',
        steps: [
          '任一源判恶意 → 汇总判恶意；都未知 → unknown',
          '写 merge_intel() 与 3 个测试',
          'README 补一段数据来源与免责声明',
        ],
        deliverable: 'merge_intel + 3 个通过测试',
        minutes: 45,
      },
      {
        id: 't3-6',
        featureId: 'f3-intel',
        title: '把情报接进 URL 检测',
        steps: [
          '检测流程里加一步：查情报，命中就加分并附来源',
          '分数上限与规则权重重新平衡一次',
          '在 20 条样本上对比接情报前后的准确率',
        ],
        deliverable: '检测报告里能看到情报来源',
        minutes: 60,
      },
    ],
  },
  {
    id: 'f4-deepseek',
    name: '4 · DeepSeek API 自动分析',
    goal: '把特征与情报交给 DeepSeek，输出结构化判断和可读理由；失败要能回退。',
    tasks: [
      {
        id: 't4-1',
        featureId: 'f4-deepseek',
        title: '接 DeepSeek Chat API',
        steps: [
          '写 llm_client.py：POST https://api.deepseek.com/chat/completions',
          '读取 DEEPSEEK_API_KEY，设置 30 秒超时',
          '先用一句“你好”跑通，再打印 usage',
        ],
        deliverable: '一次真实调用成功并打印 token 用量',
        minutes: 60,
      },
      {
        id: 't4-2',
        featureId: 'f4-deepseek',
        title: '设计分析 prompt 模板',
        steps: [
          'prompt 输入：URL + 特征 JSON + 情报 JSON',
          '要求输出 JSON：verdict(phishing/suspicious/benign)、score、reasons[3]、evidence[]',
          '把模板放到 prompts/analyze_url.txt，方便迭代',
        ],
        deliverable: 'prompt 文件 + 一次输出示例',
        minutes: 60,
      },
      {
        id: 't4-3',
        featureId: 'f4-deepseek',
        title: 'JSON 输出校验与一次重试',
        steps: [
          '用 json.loads 解析，字段缺失或越界就重试一次',
          '重试仍失败则回退规则分数',
          '写 3 个异常样本测试（空输出、多话、字段缺失）',
        ],
        deliverable: '异常输入不会让程序崩',
        minutes: 60,
      },
      {
        id: 't4-4',
        featureId: 'f4-deepseek',
        title: '成本控制与缓存',
        steps: [
          'max_tokens 限制 + 相同 URL 24 小时内走缓存',
          '记录每次调用 token 与费用估算到 logs/',
          '跑 5 次，确认缓存命中',
        ],
        deliverable: '缓存命中日志 + 单次成本估算',
        minutes: 45,
      },
      {
        id: 't4-5',
        featureId: 'f4-deepseek',
        title: '规则 + LLM 融合打分',
        steps: [
          '规则分与 LLM 分各占权重，冲突时给出两种结论',
          '报告里标注“规则判定 / 模型判定 / 综合判定”',
          '在 20 条样本上记录三者差异',
        ],
        deliverable: '三者对比表写进 README',
        minutes: 60,
      },
      {
        id: 't4-6',
        featureId: 'f4-deepseek',
        title: 'Prompt 二期：钓鱼邮件分析',
        steps: [
          '复用邮件报告 JSON 作为输入，输出 verdict + 3 条理由',
          '处理中文邮件样本 2 封',
          '把 prompt 存到 prompts/analyze_email.txt',
        ],
        deliverable: '邮件分析 prompt + 2 份输出',
        minutes: 45,
      },
    ],
  },
  {
    id: 'f5-report',
    name: '5 · 风险评分与安全报告',
    goal: '把各模块结果合成一个分数、一个等级、一份可发给别人看的报告。',
    tasks: [
      {
        id: 't5-1',
        featureId: 'f5-report',
        title: '总分公式与风险等级',
        steps: [
          '定义 0-100 分公式：规则 40% + 情报 30% + LLM 30%',
          '定等级：0-24 低 / 25-59 中 / 60-84 高 / 85-100 危',
          '写 risk.py + 4 个边界测试',
        ],
        deliverable: 'risk.py 与边界测试通过',
        minutes: 45,
      },
      {
        id: 't5-2',
        featureId: 'f5-report',
        title: 'Markdown 报告生成',
        steps: [
          '报告结构：结论、分数、证据、原因、建议、数据来源',
          '用模板字符串生成，文件名带日期',
          '对一封样例生成并通读改一遍措辞',
        ],
        deliverable: 'reports/2026-xx-xx.md 一份完整报告',
        minutes: 60,
      },
      {
        id: 't5-3',
        featureId: 'f5-report',
        title: 'HTML 报告 + 打印样式',
        steps: [
          'Markdown 转 HTML（markdown 库或手写模板）',
          '加一段 minimal CSS，适合打印/截图',
          '生成一份 HTML 并在浏览器检查',
        ],
        deliverable: '可直接截图放进作品集的 HTML 报告',
        minutes: 60,
      },
      {
        id: 't5-4',
        featureId: 'f5-report',
        title: '报告里嵌入证据片段',
        steps: [
          '规则命中项带原始依据（URL 片段、header 原文）',
          '情报命中带来源链接',
          'LLM 结论带引用到的特征编号',
        ],
        deliverable: '报告每条结论都能追溯到证据',
        minutes: 45,
      },
      {
        id: 't5-5',
        featureId: 'f5-report',
        title: '端到端脚本：URL → 报告',
        steps: [
          '写 analyze_url.py：一条命令跑完 抓取→特征→情报→LLM→评分→报告',
          '失败时给出是哪一步失败，不要静默',
          '用 1 个正常 + 1 个可疑 URL 各跑一次',
        ],
        deliverable: '两条命令产出两份报告',
        minutes: 60,
      },
    ],
  },
  {
    id: 'f6-platform',
    name: '6 · 整合成 AI 安全分析平台',
    goal: '把上面 5 个能力包成一个可访问的服务 + 一个能演示的页面。',
    tasks: [
      {
        id: 't6-1',
        featureId: 'f6-platform',
        title: 'FastAPI 包一层 API',
        steps: [
          '写 app.py：POST /analyze/url、POST /analyze/email',
          '请求体用 pydantic 校验，错误返回 4xx 而不是 500',
          'uvicorn 跑起来，用 curl 测两个接口',
        ],
        deliverable: '本地 8000 端口两个接口可用',
        minutes: 60,
      },
      {
        id: 't6-2',
        featureId: 'f6-platform',
        title: '最小前端页面',
        steps: [
          '一个输入框 + 一个按钮 + 结果区（原生 HTML/JS 即可）',
          '调 /analyze/url，展示分数、等级、3 条理由',
          '加载态与错误态都要有',
        ],
        deliverable: '浏览器里能完成一次完整分析',
        minutes: 60,
      },
      {
        id: 't6-3',
        featureId: 'f6-platform',
        title: 'Dockerfile 与本地构建',
        steps: [
          '写 Dockerfile（python:3.12-slim + requirements）',
          'docker build 与 docker run 各跑一次',
          'README 补 docker 用法',
        ],
        deliverable: '一条 docker run 就能起服务',
        minutes: 60,
      },
      {
        id: 't6-4',
        featureId: 'f6-platform',
        title: 'GitHub Actions CI',
        steps: [
          '加 .github/workflows/ci.yml：装依赖 + pytest + ruff',
          '修到 CI 全绿',
          'README 放 CI 徽章',
        ],
        deliverable: '仓库首页有绿色 CI 徽章',
        minutes: 45,
      },
      {
        id: 't6-5',
        featureId: 'f6-platform',
        title: '部署到免费平台',
        steps: [
          '选 Render / Fly.io 之一，配置环境变量',
          '部署成功，用公网 URL 跑一次分析',
          'README 放演示链接与限制说明（免费实例会休眠）',
        ],
        deliverable: '一个公网可访问的 demo 链接',
        minutes: 60,
      },
      {
        id: 't6-6',
        featureId: 'f6-platform',
        title: '2 分钟演示 GIF + 项目总结',
        steps: [
          '录屏：输入可疑 URL → 分数 → 报告',
          '压成 GIF/MP4 放 docs/demo.gif',
          'README 首屏放演示 + 3 句话讲清价值',
        ],
        deliverable: 'README 首屏有演示图与一句话介绍',
        minutes: 45,
      },
    ],
  },
]

/** 后续项目（作品集扩展，先记录不排期） */
export const NEXT_PROJECTS = [
  'AI Network Intrusion Detection（用 NSL-KDD / CICIDS 数据做流量分类）',
  'AI Phishing Email Detector（独立成产品，支持批量导入）',
  'LLM Security Testing Framework（prompt injection / jailbreak 测试集）',
]

export function featureById(id: string) {
  return PROJECT_FEATURES.find((f) => f.id === id)
}
