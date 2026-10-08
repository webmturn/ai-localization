// 帮助中心复用现有模态框、设置入口与快捷键服务，不读取项目内容或密钥。
(function () {
  const featureGroups = [
    { section: "files", title: "项目与文件", icon: "folder-open", summary: "新建、打开和管理项目；导入多格式资源，编辑源文件并重新解析。" },
    { section: "proofread", title: "翻译与校对", icon: "list-check", summary: "批量或选中翻译，查看进度与失败项；多选、搜索、分页、校对标记和查找替换。" },
    { section: "engines", title: "翻译引擎", icon: "sliders", summary: "内置 AI 与传统引擎、自定义兼容端点；配置密钥、模型、温度、并发、重试和短期缓存。" },
    { section: "ai", title: "AI 增强与模板", icon: "wand-magic-sparkles", summary: "Key 参考、相邻上下文、Priming 原文样本、会话记忆和项目 Prompt 模板。" },
    { section: "resources", title: "术语与翻译记忆", icon: "book", summary: "维护固定译名，导入导出术语；自动复用翻译记忆，搜索记录并导出 TMX。" },
    { section: "quality", title: "质量检查", icon: "shield-halved", summary: "按项目或文件检查术语、占位符、变量、标点、数字、长度、空译文和重复；导出质量报告。" },
    { section: "export", title: "导出与交付", icon: "file-export", summary: "按原资源格式或 XML、XLIFF、JSON、YAML、CSV 导出，选择包含原文或仅已翻译项。" },
    { section: "appearance", title: "工作区与偏好", icon: "palette", summary: "校对优先或经典三栏，调整列表密度、主题、字体、滚动行为与移动端操作。" },
    { section: "shortcuts", title: "快捷键", icon: "keyboard", summary: "查看当前生效的快捷键，自定义常用操作，并了解编辑时的按键规则。" },
    { section: "data", title: "保存与数据管理", icon: "database", summary: "自动保存、项目 JSON、数据备份、导入迁移、文件夹存储和缓存清理。" },
  ];
  const sections = [
    { id: "start", title: "快速开始", icon: "rocket", description: "打开一个文件，批量翻译后逐条校对。", steps: true, topics: [
      { title: "导入并选中文件", paragraphs: ["点击左侧「浏览文件」选择文件，或直接拖入。导入后选中文件，中间区域会显示原文与译文。", "已有项目可通过「打开项目」继续处理。"] },
      { title: "配置翻译引擎", paragraphs: ["选择源语言、目标语言和引擎。首次使用在线引擎，在「偏好 → 翻译引擎」填写 API 密钥，测试连接后保存。", "也可以手动编辑和校对译文。"], action: "engine", actionLabel: "配置翻译引擎" },
      { title: "批量翻译，逐条校对", paragraphs: ["点击「翻译当前文件」处理待翻译项，或选中条目后点击「翻译选中」。运行中可暂停、继续或取消。", "在「待校对」中修改译文，再「标记已校对」。"] },
      { title: "检查并导出结果", paragraphs: ["运行质量检查，确认占位符、数字与标签，再「导出翻译」选择所需格式。", "「保存项目」保留编辑进度；「导出翻译」生成交付文件。"] },
    ] },
    { id: "overview", title: "功能总览", icon: "grip", description: "按工作环节查看工具的全部主要功能，点击卡片中的说明入口了解具体用法。", overview: true, topics: featureGroups.map(group => ({ title: group.title, icon: group.icon, paragraphs: [group.summary], section: group.section, actionLabel: "查看使用说明" })) },
    { id: "files", title: "项目与文件", icon: "folder-open", description: "管理多个项目、导入资源和维护原始文件。", topics: [
      { title: "新建、打开与保存项目", paragraphs: ["点击顶栏「新建项目」填写名称和源、目标语言。「打开项目」用于载入之前保存的项目 JSON，继续处理条目与译文。", "用户菜单中的「保存项目」会保存当前数据并下载项目 JSON。手机可在「更多」中打开和保存项目。"] },
      { title: "项目管理与切换", paragraphs: ["从用户菜单或手机「更多」打开「项目管理」，可搜索已保存项目，切换项目、重命名、导出或删除，也可以进入「创建/导入」。", "切换前保存当前修改；删除项目和清理数据前先保留需要的备份。"] },
      { title: "多格式导入与文件处理", paragraphs: ["支持 JSON、通用 XML、Android strings.xml、XLIFF、YAML / YML、CSV / TSV、PO / POT、RESX、iOS Strings、Qt TS 和文本。可选择多个文件或拖入文件，文件列表显示各文件的进度。语法错误的文件不会生成翻译条目；同名文件导入失败时保留已有内容。", "在「偏好 → 文件处理」调整大小限制、各格式开关、导入编码和导入后自动翻译。旧编码自动识别只是尝试；发现乱码时指定实际编码并重新导入。启用自动翻译前，先配置语言和引擎。", "PO、Qt TS 的已有复数形态分别显示为独立条目。XML 内联标签显示为标记，悬停查看完整标签；带注释、引用位置或原始状态的条目可展开「资源详情」。"], action: "file", actionLabel: "打开文件处理设置" },
      { title: "编辑源文件与重新解析", paragraphs: ["文件行有编辑入口时，可打开源文件编辑器修改原始内容，再点击「保存并重新解析」。没有原始内容的文件不会显示该入口。", "重新解析会按资源标识或原文匹配保留已有译文；新增和修改过的原文需再次确认译文。语法检查失败时先修正文件内容。"] },
      { title: "文件搜索与处理范围", paragraphs: ["左侧文件搜索用于查找文件，中间条目搜索用于查找原文、译文和条目标识。点击文件可切换翻译和校对范围，也可查看全部项目条目。", "文件移除会影响该文件的项目条目。执行前确认文件名称，并保存需要保留的项目或原始资源。"] },
    ] },
    { id: "proofread", title: "翻译与校对", icon: "list-check", description: "掌握处理范围、校对标记、批量编辑与进度控制。", topics: [
      { title: "确认翻译范围", paragraphs: ["选中文件后，「翻译当前文件」只处理该文件的待翻译项。已有非空译文会保留；需要重译时，先选中条目，再使用「翻译选中」。", "「翻译选中」根据当前选中条目执行。多文件项目中，先检查文件名称和选中数量。"] },
      { title: "用状态筛选安排校对", paragraphs: ["「待翻译」用于定位未完成的原文；「待校对」用于检查已有译文；「已校对」用于回看确认过的条目。", "非空译文才能标记为已校对。再次修改已校对的译文后，需要重新确认校对标记。"] },
      { title: "搜索、分页与连续编辑", paragraphs: ["查找条可搜索原文、译文及条目标识。搜索和状态筛选会一起作用于当前文件。每页条数和页码跳转位于列表底部。", "在译文框中按 Tab 或 Shift + Tab 前往下一条或上一条，必要时会自动翻页。Shift + Enter 保留为编辑时的换行。"] },
      { title: "失败后继续处理", paragraphs: ["进度区域可查看失败项和错误记录。修正密钥、模型、网络或输入内容后，点击「重试失败」；已完成的译文会保留。", "取消会停止继续发送请求，已经完成的结果仍可保存和校对。"] },
      { title: "多选、全选与清除译文", paragraphs: ["通过条目选择框，或 Ctrl / ⌘ + 点击条目进行多选；「全选当前页」只选择这一页。确认选中数量后，可批量翻译或标记已校对。", "「更多 → 清除译文」清除多选条目的译文；没有多选时处理当前选中条目。清除后需重新翻译或填写译文。"] },
      { title: "批量查找替换", paragraphs: ["点击工具栏「查找替换」，输入查找内容和替换内容，选择「当前文件」或「全项目」。支持正则表达式和区分大小写。", "先点「预览」查看匹配数量及修改前后的译文，再「执行替换」。替换作用于译文，不会改写源文件；没有选中文件时，当前文件范围会使用全项目条目。"], action: "replace", actionLabel: "打开查找替换" },
      { title: "暂停、取消和预计时间", paragraphs: ["翻译进度区域显示完成数量、失败项、日志和预计剩余时间。暂停后可继续；取消后保留已经完成的结果。", "预计时间会随请求速度变化。保存进度后重开项目，可继续处理未完成条目，不会自动恢复已取消的网络请求。"] },
    ] },
    { id: "engines", title: "翻译引擎", icon: "sliders", description: "连接内置与自定义服务，控制请求行为。", topics: [
      { title: "内置引擎与 API Key", paragraphs: ["AI 引擎包括 DeepSeek、OpenAI、Gemini 和 Claude；传统引擎提供 Google 翻译。API 密钥、模型和连接测试都位于「偏好 → 翻译引擎」。", "「从 API 获取」可以读取服务提供的模型列表，也会使用当前表单里刚填写的密钥。完整设置中的修改在点击「保存设置」后生效，取消会放弃草稿。"], action: "engine", actionLabel: "打开引擎设置" },
      { title: "接入自定义引擎", paragraphs: ["在「翻译引擎」旁点击「自定义引擎」，填写 OpenAI 兼容的 API 端点和模型名称。按服务要求决定是否需要密钥。", "本地服务也可以通过自定义引擎接入。端点通常以 /chat/completions 结尾；连接能否成功取决于该服务的接口和浏览器访问配置。"], action: "custom", actionLabel: "管理自定义引擎" },
      { title: "超时、并发、重试与温度", paragraphs: ["在引擎设置中调整请求超时、并发数量、失败重试次数和温度。并发受引擎限速和批量分块限制约束；开启会话记忆时分块按顺序执行。", "「不重试」仍会执行首次请求。温度越低通常越稳定，服务不支持的参数由对应引擎处理。"], action: "engine", actionLabel: "调整请求参数" },
      { title: "请求去重与短期缓存", paragraphs: ["启用「翻译请求短期缓存」后，相同请求在缓存 TTL 内可复用结果。请求去重用于避免同时重复发送相同请求。", "短期缓存用于重复请求；翻译记忆用于保存原文与译文、跨次复用。两者的设置与用途不同。"], action: "engine", actionLabel: "配置短期缓存" },
    ] },
    { id: "ai", title: "AI 增强与模板", icon: "wand-magic-sparkles", description: "给 AI 提供语境、命名风格与项目翻译要求。", topics: [
      { title: "Key 参考与相邻上下文", paragraphs: ["在「偏好 → 翻译引擎」的 AI 增强设置中，开启 Key / 字段名参考，让模型理解资源用途。上下文感知会附带前后相邻条目，窗口大小可调整。", "这些参考随翻译请求发送至所选 AI 服务。它们帮助理解语境，最终译文仍需校对。"], action: "engine", actionLabel: "打开 AI 增强设置" },
      { title: "Priming 原文样本", paragraphs: ["开启 Priming 并设置样本数，再点击「选择样本」，从当前文件或项目条目中选择有代表性的原文，让模型先理解领域和命名风格。", "Priming 是 source-only 原文参考，不是预先确认的译文，也不能代替术语库。选好样本后保存设置。"], action: "engine", actionLabel: "配置 Priming 样本" },
      { title: "多轮会话记忆", paragraphs: ["开启多轮会话记忆，可按「项目全局」「文件类型」或「文件」共享翻译上下文。引擎设置中的「查看会话」支持查看并复制已有会话。", "切换领域或风格前可「清空会话」，再重新建立语境。会话记忆与保存原文、译文的翻译记忆库是两项功能。"], action: "engine", actionLabel: "查看会话设置" },
      { title: "项目 Prompt 模板", paragraphs: ["在「偏好 → Prompt 模板（项目）」编辑通用 System Prompt；OpenAI、DeepSeek 单条和 AI 批量模板可分别覆盖，留空继承通用模板。通用模板可恢复默认，各覆盖模板可清空。", "可使用 {{sourceLanguage}}、{{targetLanguage}} 插入语言名称，{{sourceLang}}、{{targetLang}} 插入语言代码。批量模板应保留 JSON 输出要求；模板随当前项目保存。"], action: "promptTemplates", actionLabel: "编辑项目 Prompt" },
      { title: "批量大小与字符上限", paragraphs: ["AI 增强设置可调整每批最多条数和每批最多字符，达到任一上限就分批请求。内容较长、服务限制较小或频繁失败时，可减小批量。", "分批用于控制请求规模，不会静默截断完整原文。遇到服务输入限制或输出截断，需要拆分内容或调整服务参数。"], action: "engine", actionLabel: "调整批量设置" },
    ] },
    { id: "resources", title: "术语与翻译记忆", icon: "book", description: "统一固定译名，复用已经积累的翻译结果。", topics: [
      { title: "添加、编辑与查找术语", paragraphs: ["从「术语」入口打开术语库，添加源术语、目标术语、词性与可选定义。可搜索、按词性筛选、分页查看，以及编辑或删除已有术语。", "在「偏好 → 术语库」调整自动应用、匹配方式和高亮显示；保持产品名与专业用语的译法一致。"], action: "terminology", actionLabel: "打开术语库" },
      { title: "术语导入、导出与重复处理", paragraphs: ["术语库的「导入/导出」页支持 CSV、JSON 导入；导入前选择合并或覆盖现有术语。合并时跳过已有源术语，覆盖会替换当前术语列表。", "可导出 CSV、JSON、Excel 或 XML，按词性筛选，并选择包含定义和元数据。术语导入格式与翻译资源导入格式不同。"], action: "terminology", actionLabel: "管理术语导入与导出" },
      { title: "翻译记忆自动复用", paragraphs: ["在引擎设置中开启「翻译时自动应用翻译记忆库（TM）」。成功的翻译结果可积累为记忆；相同原文与语言对的精确命中会直接复用并跳过 API。", "模糊匹配阈值用于相似内容查询，相似命中不会按精确命中直接跳过翻译。复用后的译文仍需按当前语境校对。"], action: "engine", actionLabel: "配置翻译记忆应用" },
      { title: "记忆库查询与 TMX 导出", paragraphs: ["打开翻译记忆库可查看数量与语言信息，按源文本搜索记录、刷新列表，并导出 TMX 供其他翻译工具使用。", "清空会删除记忆记录，执行前先导出需要保留的 TMX。记忆库当前没有 TMX 导入入口。"], action: "memory", actionLabel: "管理翻译记忆" },
    ] },
    { id: "quality", title: "质量检查", icon: "shield-halved", description: "检查常见资源问题，查看评分、定位条目并导出报告。", topics: [
      { title: "项目与当前文件检查", paragraphs: ["从「质量」入口打开报告并运行检查。可在「偏好 → 质量检查」选择按项目或当前文件检查；按文件检查前先在文件列表选中文件。", "检查结果对应运行时的范围。修改译文后点击「重新检查」，更新问题与评分。"], action: "qualitySettings", actionLabel: "设置检查范围" },
      { title: "检查规则与质量阈值", paragraphs: ["检查覆盖术语一致性、格式占位符、变量、标点、数字、长度、空译文和重复问题。术语、占位符、标点、长度和数字规则可在设置中开关。", "质量分数阈值用于提示低于目标的结果。评分和规则检查用于辅助校对，不等于对翻译语义正确性的保证。"], action: "qualitySettings", actionLabel: "配置检查规则" },
      { title: "筛选问题与返回条目", paragraphs: ["报告显示总体进度、质量分数和分析图表。按严重程度与问题类型筛选，查看每项问题的原文、译文和说明。", "点击问题条目返回工作区定位对应条目，必要时自动翻页。修正后重新运行检查，确认问题是否消除。"] },
      { title: "导出质量报告", paragraphs: ["点击「导出报告」下载 JSON，包含检查范围、分数、数量和问题详情；可用于留档或与其他工具处理。", "「导出PDF」打开打印报告，在打印对话框中选择保存为 PDF。若报告窗口没有出现，检查浏览器是否拦截了弹出窗口。"] },
    ] },
    { id: "export", title: "导出与交付", icon: "file-export", description: "选择交付格式，明确导出范围和未翻译项的处理方式。", topics: [
      { title: "原格式与通用格式", paragraphs: ["点击顶栏「导出项目」或侧栏「导出翻译」，选择「原格式（按导入文件）」或 XML、XLIFF、JSON、YAML、CSV。原格式会按各文件分别生成结果。", "需要保留资源结构时优先选择原格式。缺少原始内容时可能退回通用导出，无法保证保留全部原结构；迁移项目时同时保留原始文件。"] },
      { title: "导出范围与导出选项", paragraphs: ["导出基于项目条目；当前搜索结果、状态筛选和当前页不会限制导出范围。选择「仅导出已翻译项」时，保留已有非空译文且状态为已翻译、已编辑或已校对的条目。", "「包含原文」与「仅导出已翻译项」为二选一。是否以单独原文字段呈现，取决于所选格式。导出前确认语言、格式与选项。"] },
      { title: "保存项目与翻译交付文件", paragraphs: ["项目 JSON 保存编辑所需的条目、译文、进度与项目配置，可通过「打开项目」继续编辑。导出翻译生成供产品或开发使用的资源文件。", "项目 JSON 的源文件内容可能使用本地引用。跨设备继续工作时，保留原始资源文件及所需备份，不能只依赖本地引用。"] },
    ] },
    { id: "appearance", title: "工作区与偏好", icon: "palette", description: "按校对习惯调整布局与显示。", topics: [
      { title: "桌面布局与文件栏", paragraphs: ["在「偏好 → 外观设置」选择「校对优先」或「经典三栏」，设置翻译面板默认收起或展开，以及紧凑文件导入区。", "校对优先布局把主要空间留给原文与译文，右侧提供设置、术语、记忆、质量和偏好入口。文件栏宽度可按需要调整。"], action: "appearance", actionLabel: "调整工作区布局" },
      { title: "主题、字体与列表密度", paragraphs: ["外观设置提供浅色、深色和自动主题，小、中、大字体，紧凑或舒适列表密度，以及每页条数。", "可调整原文选中提示条、未选中提示颜色和自动滚动到选中项，让连续校对更容易定位。"], action: "appearance", actionLabel: "调整显示偏好" },
      { title: "手机与窄屏操作", paragraphs: ["手机底部提供文件、翻译、全选和设置入口；项目管理、保存项目、帮助与关于等位于顶栏「更多」。侧栏以底部面板展示，可关闭后继续编辑。", "帮助页使用主题选择框浏览全部栏目，正文独立滚动。手机的全选入口与桌面一样按当前页处理。"] },
    ] },
    { id: "shortcuts", title: "快捷键", icon: "keyboard", description: "下方显示当前生效的快捷键，包括你在设置中的自定义修改。", topics: [
      { title: "编辑时的按键规则", paragraphs: ["在输入框中，Ctrl / ⌘ + A 保留为文字全选，Shift + Enter 保留为换行。保存项目、取消翻译和 Esc 仍可使用；其他工作区快捷键请先退出输入框。", "Esc 关闭最上层弹窗；在译文框中会先退出编辑。帮助和关于窗口内不会触发翻译、选择或翻页操作。"], action: "shortcuts", actionLabel: "自定义快捷键" },
    ] },
    { id: "faq", title: "常见问题", icon: "circle-question", description: "展开问题查看处理方法。", faq: true, topics: [
      { title: "支持哪些文件格式？", paragraphs: ["支持 JSON、XML、Android strings.xml、XLIFF（.xlf / .xliff）、YAML、CSV / TSV、PO、RESX、iOS Strings、Qt TS 和文本文件。其他扩展名会尝试按文本解析。", "导出时优先选择对应资源格式。能否完整保留结构，取决于原文件格式和所选导出方式。"] },
      { title: "密钥已填写，为什么还无法翻译？", paragraphs: ["在引擎设置中确认类别、引擎、API Key 和模型对应，先点击「测试连接」，再保存设置。鉴权失败需检查密钥；额度不足需检查服务账户；网络失败需检查端点和连接。"], action: "engine", actionLabel: "检查引擎配置" },
      { title: "翻译当前文件为什么没有处理全部条目？", paragraphs: ["批量翻译会保留已有非空译文，优先处理待翻译项。需要覆盖某条已有译文时，选中该条目后使用「翻译选中」。", "先确认当前文件范围。搜索结果不是整个项目的条目总数。"] },
      { title: "原文很长，或者返回的译文不完整怎么办？", paragraphs: ["完整原文会发送到所选引擎，超过服务限制时会明确报错。批量输出不完整时会尝试拆小批次；仍失败时，请减小批量大小或拆分原文。", "服务明确返回截断信号时，该结果不会被标记为翻译成功。"] },
      { title: "项目保存了，换浏览器后为什么找不到？", paragraphs: ["默认项目数据保存在当前浏览器的本地存储中，不会自动同步到另一台设备或另一浏览器。清理浏览器数据也可能删除这些记录。", "迁移或长期保留项目时，先在「偏好 → 数据管理」导出备份，再在目标环境导入。"], action: "data", actionLabel: "打开数据管理" },
      { title: "首次运行质量检查或导出为什么稍慢？", paragraphs: ["部分组件会在首次使用时加载。等待加载完成后再次使用即可；若提示加载失败，请检查应用资源是否完整，或刷新页面后重试。"] },
    ] },
    { id: "data", title: "数据与备份", icon: "database", description: "区分项目保存、翻译文件交付与数据备份。", topics: [
      { title: "手动保存与自动保存", paragraphs: ["「保存项目」保存当前数据并下载项目 JSON；自动保存定期保留当前项目进度，便于之后继续编辑。导出翻译则用于生成交付文件。", "自动保存开关和间隔位于「偏好 → 数据管理」。重要修改完成后，也可主动点击「保存项目」。"], action: "data", actionLabel: "配置自动保存" },
      { title: "备份和迁移", paragraphs: ["在「偏好 → 数据管理」中，可备份全部数据，或分别导出项目、术语和设置。迁移设备、浏览器或清理本地记录前，先保留备份。", "导入备份前查看导入方式，避免误覆盖已有内容。配置了文件系统存储时，也需妥善保存对应目录。"], action: "data", actionLabel: "管理备份" },
      { title: "哪些内容会发送给翻译服务？", paragraphs: ["默认项目和设置在本地保存。调用在线翻译引擎时，待翻译原文及启用的上下文、术语或样本会发送至所选服务。", "自定义引擎将请求发送到你填写的端点。手动编辑和校对不需要发起翻译请求。"] },
      { title: "文件夹存储", paragraphs: ["在「偏好 → 数据管理」点击「启用文件夹存储」，在支持的环境中选择并授权本地目录，保存项目和配置。当前存储状态会显示是否已连接或需要重新授权。", "可「停用文件夹存储，切回浏览器本地」。这是本地存储位置设置，不会自动同步另一台设备；迁移时保留对应目录和原始资源文件。"], action: "data", actionLabel: "查看存储位置" },
      { title: "缓存清理与数据删除", paragraphs: ["「清理缓存数据」提供「仅清除当前项目」和「清除全部（包含设置/术语库）」两种范围，执行前确认选择并保留所需备份。", "清理项目与清空翻译记忆库是不同入口。需要删除记忆时进入记忆库；需要保留的数据应分别导出。"], action: "data", actionLabel: "打开数据管理" },
    ] },
  ];

  let initialized = false;
  let currentSection = "start";
  let returnTarget = null;
  let readingScroll = 0;
  let copyRequest = 0;
  const get = (id) => document.getElementById(id);
  const make = (tag, className, text) => {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
  };
  const version = () => document.querySelector('meta[name="application-version"]')?.content || "未知版本";
  const addAction = (parent, topic) => {
    if (topic.section) {
      const button = make("button", "help-action", topic.actionLabel);
      button.type = "button"; button.dataset.helpTargetSection = topic.section;
      button.setAttribute("aria-label", "查看" + topic.title + "使用说明"); parent.append(button); return;
    }
    const actions = topic.actions || (topic.action ? [{ id: topic.action, label: topic.actionLabel }] : []);
    if (!actions.length) return;
    const row = make("div", "help-topic-actions");
    actions.forEach(action => {
      const button = make("button", "help-action", action.label);
      button.type = "button"; button.dataset.helpAction = action.id; row.append(button);
    });
    parent.append(row);
  };
  function renderContent() {
    const nav = get("helpNavigation"), content = get("helpSections");
    nav.replaceChildren(); content.replaceChildren();
    const picker = get("helpTopicSelect");
    picker.replaceChildren();
    sections.forEach((section) => {
      const option = make("option", "", section.title); option.value = section.id; picker.append(option);
      const button = make("button", "help-nav-button");
      button.type = "button"; button.dataset.helpSection = section.id;
      button.setAttribute("aria-controls", "help-section-" + section.id);
      const icon = make("i", "fa-solid fa-" + section.icon); icon.setAttribute("aria-hidden", "true");
      button.append(icon, make("span", "", section.title)); nav.append(button);
      const panel = make("section", "help-section"); panel.id = "help-section-" + section.id;
      panel.dataset.helpPanel = section.id;
      const title = make("h4", "help-section-title", section.title); title.id = panel.id + "-title";
      panel.setAttribute("aria-labelledby", title.id);
      panel.append(title, make("p", "help-section-description", section.description));
      const topics = make("div", "help-topics" + (section.steps ? " help-steps" : section.overview ? " help-overview" : ""));
      section.topics.forEach((topic, index) => {
        const card = make(section.faq ? "details" : "article", section.faq ? "help-topic help-faq" : "help-topic");
        card.dataset.helpTopic = "";
        if (topic.section) card.dataset.helpFeature = topic.section;
        const heading = make(section.faq ? "summary" : "h5", "help-topic-title");
        if (section.steps) heading.append(make("span", "help-step-number", String(index + 1)));
        if (topic.icon) { const icon = make("i", "fa-solid fa-" + topic.icon); icon.setAttribute("aria-hidden", "true"); heading.append(icon); }
        heading.append(make("span", "", topic.title));
        if (section.faq) { const arrow = make("i", "fa-solid fa-chevron-down"); arrow.setAttribute("aria-hidden", "true"); heading.append(arrow); }
        const body = make("div", "help-topic-body");
        topic.paragraphs.forEach(text => body.append(make("p", "", text)));
        addAction(body, topic); card.append(heading, body); topics.append(card);
      });
      if (section.id === "shortcuts") { const list = make("div", "help-shortcut-list"); list.id = "helpShortcutList"; topics.append(list); }
      panel.append(topics); content.append(panel);
    });
  }
  function renderShortcuts() {
    const list = get("helpShortcutList"); if (!list) return;
    list.replaceChildren();
    const keys = typeof getEffectiveShortcutKeys === "function" ? getEffectiveShortcutKeys() : {};
    const definitions = typeof KEYBOARD_SHORTCUT_DEFINITIONS !== "undefined" ? KEYBOARD_SHORTCUT_DEFINITIONS : [];
    definitions.forEach(def => {
      const row = make("div", "help-shortcut-row"); row.dataset.helpTopic = "";
      row.append(make("span", "", def.id === "translateAll" ? "翻译待翻译项（当前文件范围）" : def.label));
      let key = keys[def.id] || def.defaultKeys;
      if (/Mac|iPhone|iPad|iPod/i.test(navigator.platform)) key = key.replace(/ctrl/gi, "meta");
      row.append(make("kbd", "", typeof formatKeyDisplay === "function" ? formatKeyDisplay(key) : key)); list.append(row);
    });
  }
  function updateSections() {
    get("helpSections").querySelectorAll("[data-help-panel]").forEach(panel => {
      panel.hidden = panel.dataset.helpPanel !== currentSection;
    });
    get("helpNavigation").querySelectorAll("[data-help-section]").forEach(button => {
      if (button.dataset.helpSection === currentSection) button.setAttribute("aria-current", "page");
      else button.removeAttribute("aria-current");
    });
    get("helpTopicSelect").value = currentSection;
  }
  function selectSection(id) {
    if (!sections.some(section => section.id === id)) id = "start";
    currentSection = id; updateSections();
    readingScroll = 0; get("helpContent").scrollTop = 0;
    get("helpNavigation").querySelector('[data-help-section="' + id + '"]')?.scrollIntoView?.({ block: "nearest" });
  }
  function open(kind = "help", section, trigger) {
    const visible = [get("helpModal"), get("aboutModal")].find(modal => modal && !modal.classList.contains("hidden"));
    if (!visible) returnTarget = trigger || document.activeElement;
    if (visible?.id === "helpModal") readingScroll = get("helpContent").scrollTop;
    if (visible) closeModal(visible.id);
    if (returnTarget?.isConnected) returnTarget.focus({ preventScroll: true });
    openModal(kind === "about" ? "aboutModal" : "helpModal");
    if (kind !== "about" && section !== undefined) selectSection(section);
  }
  function closeForAction() {
    if (!get("helpModal").classList.contains("hidden")) readingScroll = get("helpContent").scrollTop;
    ["helpModal", "aboutModal"].forEach(id => { if (!get(id).classList.contains("hidden")) closeModal(id); });
    if (returnTarget?.isConnected) returnTarget.focus({ preventScroll: true });
  }
  function openSettings(tab) {
    closeForAction();
    openModal("settingsModal");
    document.querySelector('.settings-tab-btn[data-tab="' + tab + '"]')?.click();
  }
  async function copyVersionInfo() {
    const button = get("aboutCopyVersion"), status = get("aboutCopyStatus");
    const request = ++copyRequest;
    const isCurrent = () => request === copyRequest && !get("aboutModal").classList.contains("hidden");
    const text = ["智能翻译工具 v" + version(),
      "运行环境：" + (window.__TAURI_INTERNALS__ ? "桌面应用" : "浏览器"),
      "界面语言：" + document.documentElement.lang, "浏览器：" + navigator.userAgent].join("\n");
    button.disabled = true; button.setAttribute("aria-busy", "true"); status.textContent = "正在复制版本信息…";
    try {
      if (!navigator.clipboard?.writeText) throw new Error("clipboard unavailable");
      await navigator.clipboard.writeText(text); if (!isCurrent()) return;
      status.textContent = "版本信息已复制";
      get("aboutCopyFallback").hidden = true;
    } catch (error) {
      if (!isCurrent()) return;
      get("aboutVersionDetails").value = text; get("aboutCopyFallback").hidden = false;
      status.textContent = "无法自动复制，可选中下方信息手动复制。";
      get("aboutVersionDetails").focus(); get("aboutVersionDetails").select();
    } finally { if (request === copyRequest) { button.disabled = false; button.removeAttribute("aria-busy"); } }
  }
  function init() {
    if (initialized || !get("helpModal") || !get("aboutModal")) return;
    initialized = true; renderContent();
    EventManager.add(get("helpTopicSelect"), "change", event => selectSection(event.target.value), { tag: "help", scope: "helpCenter", label: "helpTopicSelect:change" });
    EventManager.add(get("helpContent"), "scroll", () => {
      if (!get("helpModal").classList.contains("hidden")) readingScroll = get("helpContent").scrollTop;
    }, { tag: "help", scope: "helpCenter", label: "helpContent:scroll" });
    EventManager.add(get("helpNavigation"), "click", event => {
      const button = event.target.closest("[data-help-section]"); if (button) selectSection(button.dataset.helpSection);
    }, { tag: "help", scope: "helpCenter", label: "helpNavigation:click" });
    EventManager.add(get("helpNavigation"), "keydown", event => {
      if (!["ArrowRight", "ArrowLeft", "ArrowUp", "ArrowDown", "Home", "End"].includes(event.key)) return;
      const buttons = Array.from(get("helpNavigation").querySelectorAll("button"));
      const index = buttons.indexOf(event.target); if (index < 0) return;
      event.preventDefault();
      const next = event.key === "Home" ? 0 : event.key === "End" ? buttons.length - 1 :
        (index + (["ArrowRight", "ArrowDown"].includes(event.key) ? 1 : -1) + buttons.length) % buttons.length;
      buttons[next].focus(); selectSection(buttons[next].dataset.helpSection);
    }, { tag: "help", scope: "helpCenter", label: "helpNavigation:keydown" });
    EventManager.add(get("helpSections"), "click", event => {
      const section = event.target.closest("[data-help-target-section]")?.dataset.helpTargetSection;
      if (section) { selectSection(section); get("helpContent").focus({ preventScroll: true }); return; }
      const action = event.target.closest("[data-help-action]")?.dataset.helpAction;
      if (action === "custom") { openSettings("engine"); get("openSettingsCustomEngineBtn")?.click(); }
      else if (action === "terminology" || action === "memory") {
        closeForAction();
        if (action === "memory") get("openTMManagerBtn")?.click(); else openModal("terminologyModal");
      }
      else if (action === "replace") { closeForAction(); get("openFindReplaceBtn")?.click(); }
      else if (action === "qualitySettings") openSettings("quality");
      else if (["engine", "shortcuts", "data", "promptTemplates", "appearance", "file"].includes(action)) openSettings(action);
    }, { tag: "help", scope: "helpCenter", label: "helpActions:click" });
    EventManager.add(get("helpAboutBtn"), "click", () => open("about"), { tag: "help", scope: "helpCenter", label: "helpAbout:click" });
    EventManager.add(get("aboutHelpBtn"), "click", () => open("help"), { tag: "help", scope: "helpCenter", label: "aboutHelp:click" });
    EventManager.add(get("aboutCopyVersion"), "click", copyVersionInfo, { tag: "help", scope: "helpCenter", label: "aboutCopyVersion:click" });
  }
  App.ui.helpCenter = {
    init, open,
    prepare(modalId) {
      init(); if (!initialized) return;
      if (modalId === "helpModal") {
        renderShortcuts(); updateSections(); get("helpContent").scrollTop = readingScroll;
        const replace = get("helpSections").querySelector('[data-help-action="replace"]');
        replace.disabled = !get("openFindReplaceBtn") || get("openFindReplaceBtn").disabled;
        replace.title = replace.disabled ? "先导入文件或打开项目，再使用查找替换" : "打开译文的批量查找替换";
      }
      if (modalId === "aboutModal") {
        copyRequest++; get("aboutCopyVersion").disabled = false; get("aboutCopyVersion").removeAttribute("aria-busy");
        document.querySelectorAll("[data-app-version]").forEach(element => element.textContent = "v" + version());
        get("aboutCopyStatus").textContent = ""; get("aboutCopyFallback").hidden = true;
        get("aboutVersionDetails").value = ""; get("aboutModal").querySelector(".about-content").scrollTop = 0;
      }
    },
  };
})();
