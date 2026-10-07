import { beforeEach, describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const html = readFileSync('public/index.html', 'utf8');
const source = readFileSync('public/app/ui/help-center.js', 'utf8');
const modalSource = readFileSync('public/app/features/translations/export/ui.js', 'utf8');
let ui, clipboard, events;
beforeEach(() => {
  const parsed = new DOMParser().parseFromString(html, 'text/html');
  document.head.innerHTML = parsed.querySelector('meta[name="application-version"]').outerHTML;
  document.body.innerHTML = '<button id="origin">帮助入口</button>';
  for (const id of ['helpModal', 'aboutModal', 'settingsModal', 'terminologyModal', 'tmManagerModal', 'findReplaceModal']) document.body.append(parsed.getElementById(id).cloneNode(true));
  const memoryButton = parsed.getElementById('openTMManagerBtn').cloneNode(true); document.body.append(memoryButton);
  const replaceButton = parsed.getElementById('openFindReplaceBtn').cloneNode(true); replaceButton.disabled = false; document.body.append(replaceButton);
  clipboard = vi.fn(async () => {}); events = new Map();
  ui = { document, navigator: { platform: 'Win32', userAgent: 'Test Browser', clipboard: { writeText: clipboard } },
    App: { ui: {} }, requestAnimationFrame: fn => fn(),
    DOMCache: { get: id => document.getElementById(id), queryAll: (selector, root = document) => root.querySelectorAll(selector) },
    EventManager: { add(target, type, fn) { target.addEventListener(type, fn); const id = events.size + 1; events.set(id, { target, type, fn }); return id; },
      removeById(id) { const event = events.get(id); if (event) { event.target.removeEventListener(event.type, event.fn); events.delete(id); } } },
    loggers: { app: { debug() {} } },
    KEYBOARD_SHORTCUT_DEFINITIONS: [{ id: 'saveProject', label: '保存项目', defaultKeys: 'ctrl+s' }],
    getEffectiveShortcutKeys: () => ({ saveProject: 'ctrl+alt+s' }),
    formatKeyDisplay: text => text,
  };
  ui.window = ui;
  vm.createContext(ui); vm.runInContext(modalSource, ui); vm.runInContext(source, ui);
  memoryButton.addEventListener('click', () => ui.openModal('tmManagerModal'));
  replaceButton.addEventListener('click', () => ui.openModal('findReplaceModal'));
  ui.App.ui.helpCenter.open('help', 'start', document.getElementById('origin'));
});
const get = id => document.getElementById(id);
const select = section => document.querySelector('[data-help-section="' + section + '"]').click();

describe('帮助主题导航', () => {
  it('按主题显示内容，切换主题会重新定位正文', () => {
    expect(document.querySelectorAll('[data-help-panel]:not([hidden])')).toHaveLength(1);
    expect(get('help-section-start').hidden).toBe(false);
    get('helpContent').scrollTop = 180; select('proofread');
    expect(get('helpContent').scrollTop).toBe(0);
    expect(get('help-section-proofread').hidden).toBe(false);
    expect(document.querySelector('[data-help-section="proofread"]').getAttribute('aria-current')).toBe('page');
  });
  it('切换主题后恢复用户原先展开的问答', () => {
    select('faq'); const first = get('help-section-faq').querySelector('details'); first.open = true;
    select('engines'); select('faq');
    expect(first.open).toBe(true);
    expect(get('help-section-faq').querySelectorAll('details[open]')).toHaveLength(1);
  });
  it('手机主题选择与桌面主题一致', () => {
    expect(get('helpTopicSelect').options).toHaveLength(document.querySelectorAll('[data-help-section]').length);
    select('engines'); expect(get('helpTopicSelect').value).toBe('engines');
    get('helpTopicSelect').value = 'data'; get('helpTopicSelect').dispatchEvent(new Event('change'));
    expect(get('help-section-data').hidden).toBe(false);
    expect(get('helpTopicSelect').value).toBe('data');
  });
  it('方向键和 End 导航，重复初始化不增加监听器', () => {
    const nav = document.querySelector('[data-help-section="start"]'); nav.focus();
    nav.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }));
    expect(document.activeElement.dataset.helpSection).toBe('overview');
    document.activeElement.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }));
    expect(document.activeElement.dataset.helpSection).toBe('data');
    const count = events.size; ui.App.ui.helpCenter.init(); expect(events.size).toBe(count);
  });
  it('快捷键显示服务提供的当前设置，重新打开后刷新', () => {
    select('shortcuts'); expect(get('helpShortcutList').textContent).toContain('ctrl+alt+s');
    ui.getEffectiveShortcutKeys = () => ({ saveProject: 'ctrl+shift+s' });
    ui.closeModal('helpModal'); ui.App.ui.helpCenter.open('help', 'shortcuts', get('origin'));
    expect(get('helpShortcutList').textContent).toContain('ctrl+shift+s');
  });
  it('功能总览的每个分类均能导航到对应说明，且正文获得键盘焦点', () => {
    const links = Array.from(document.querySelectorAll('[data-help-target-section]'));
    expect(links.length).toBeGreaterThanOrEqual(10);
    for (const link of links) {
      select('overview'); link.click();
      expect(get('help-section-' + link.dataset.helpTargetSection).hidden).toBe(false);
      expect(get('helpTopicSelect').value).toBe(link.dataset.helpTargetSection);
      expect(document.activeElement.id).toBe('helpContent');
    }
  });
});
describe('帮助与关于的操作闭环', () => {
  it('从关于返回或关闭后重开，保留主题、问答状态和滚动位置', () => {
    select('faq'); get('help-section-faq').querySelector('details').open = true; get('helpContent').scrollTop = 120;
    get('helpAboutBtn').click(); get('aboutHelpBtn').click();
    expect(get('help-section-faq').hidden).toBe(false);
    expect(get('helpContent').scrollTop).toBe(120);
    expect(get('help-section-faq').querySelector('details[open]')).not.toBeNull();
    get('helpContent').scrollTop = 90; get('helpContent').dispatchEvent(new Event('scroll'));
    ui.closeModal('helpModal'); ui.App.ui.helpCenter.open('help', undefined, get('origin'));
    expect(get('help-section-faq').hidden).toBe(false); expect(get('helpContent').scrollTop).toBe(90);
  });
  it('从关于返回后，手动收起的问答保持收起', () => {
    select('faq'); const matching = get('help-section-faq').querySelector('details'); matching.open = true; matching.open = false;
    get('helpAboutBtn').click(); get('aboutHelpBtn').click();
    expect(matching.open).toBe(false);
  });
  it('翻译记忆入口复用现有管理按钮，关闭后返回最初入口', () => {
    select('resources'); document.querySelector('[data-help-action="memory"]').click();
    expect(get('helpModal').classList.contains('hidden')).toBe(true);
    expect(get('tmManagerModal').classList.contains('hidden')).toBe(false);
    ui.closeModal('tmManagerModal'); expect(document.activeElement.id).toBe('origin');
  });
  it.each([['file', 'files', 'file'], ['qualitySettings', 'quality', 'quality'], ['appearance', 'appearance', 'appearance'], ['promptTemplates', 'ai', 'promptTemplates']])('新增 %s 入口打开对应设置页', (action, section, expected) => {
    let active;
    document.querySelector('.settings-tab-btn[data-tab="' + expected + '"]').addEventListener('click', () => active = expected);
    select(section); get('help-section-' + section).querySelector('[data-help-action="' + action + '"]').click();
    expect(active).toBe(expected); expect(get('settingsModal').classList.contains('hidden')).toBe(false);
    ui.closeModal('settingsModal'); expect(document.activeElement.id).toBe('origin');
  });
  it('查找替换入口复用现有窗口，关闭后回到原入口', () => {
    select('proofread'); get('help-section-proofread').querySelector('[data-help-action="replace"]').click();
    expect(get('findReplaceModal').classList.contains('hidden')).toBe(false);
    expect(get('helpModal').classList.contains('hidden')).toBe(true);
    ui.closeModal('findReplaceModal'); expect(document.activeElement.id).toBe('origin');
  });
  it('无文件时查找替换入口禁用，并给出使用条件', () => {
    get('openFindReplaceBtn').disabled = true;
    ui.closeModal('helpModal'); ui.App.ui.helpCenter.open('help', 'proofread', get('origin'));
    const action = get('help-section-proofread').querySelector('[data-help-action="replace"]');
    expect(action.disabled).toBe(true); expect(action.title).toContain('先导入文件');
    action.click(); expect(get('helpModal').classList.contains('hidden')).toBe(false);
  });
  it('直接打开指定设置页，帮助关闭且保留返回入口', () => {
    let tab;
    document.querySelector('.settings-tab-btn[data-tab="engine"]').addEventListener('click', () => tab = 'engine');
    get('help-section-start').querySelector('[data-help-action="engine"]').click();
    expect(tab).toBe('engine');
    expect(get('settingsModal').classList.contains('hidden')).toBe(false);
    expect(get('helpModal').classList.contains('hidden')).toBe(true);
    ui.closeModal('settingsModal'); expect(document.activeElement.id).toBe('origin');
  });
  it('帮助和关于互相切换，最后关闭回到最初入口', () => {
    get('helpAboutBtn').click();
    expect(get('helpModal').classList.contains('hidden')).toBe(true);
    expect(get('aboutModal').classList.contains('hidden')).toBe(false);
    get('aboutHelpBtn').click(); ui.closeModal('helpModal');
    expect(document.activeElement.id).toBe('origin');
  });
  it('关于版本与包版本一致，外部链接均安全打开', () => {
    const expected = JSON.parse(readFileSync('package.json', 'utf8')).version;
    get('helpAboutBtn').click();
    expect(document.querySelector('[data-app-version]').textContent).toBe('v' + expected);
    expect(Array.from(document.querySelectorAll('.about-links a')).every(link => link.target === '_blank' && link.rel.includes('noopener'))).toBe(true);
  });
  it('复制版本信息不读取或包含项目、密钥', async () => {
    ui.SettingsCache = { get: () => { throw new Error('不应读取设置'); } };
    get('helpAboutBtn').click(); get('aboutCopyVersion').click();
    await vi.waitFor(() => expect(get('aboutCopyStatus').textContent).toBe('版本信息已复制'));
    expect(clipboard).toHaveBeenCalledOnce();
    expect(clipboard.mock.calls[0][0]).toContain('Test Browser');
    expect(clipboard.mock.calls[0][0]).not.toContain('API');
    expect(get('aboutCopyStatus').textContent).toBe('版本信息已复制');
  });
  it('剪贴板不可用时提供可选中的信息，按钮恢复可操作', async () => {
    clipboard.mockRejectedValue(new Error('denied'));
    get('helpAboutBtn').click(); get('aboutCopyVersion').click();
    await vi.waitFor(() => expect(get('aboutCopyFallback').hidden).toBe(false));
    expect(get('aboutCopyFallback').hidden).toBe(false);
    expect(document.activeElement.id).toBe('aboutVersionDetails');
    expect(get('aboutVersionDetails').selectionEnd).toBe(get('aboutVersionDetails').value.length);
    expect(get('aboutCopyVersion').disabled).toBe(false);
  });
  it('复制未完成时退出关于，迟到的失败不会抢走帮助的焦点', async () => {
    let reject; clipboard.mockImplementation(() => new Promise((resolve, fail) => reject = fail));
    get('helpAboutBtn').click(); get('aboutCopyVersion').click();
    get('aboutHelpBtn').click(); const focused = document.activeElement;
    reject(new Error('denied'));
    await vi.waitFor(() => expect(get('aboutCopyVersion').disabled).toBe(false));
    expect(document.activeElement).toBe(focused);
    expect(get('aboutCopyFallback').hidden).toBe(true);
  });
  it('关于重新打开会复位正文和复制状态，旧复制结果不覆盖新窗口', async () => {
    let resolve; clipboard.mockImplementationOnce(() => new Promise(done => resolve = done));
    get('helpAboutBtn').click(); get('aboutCopyVersion').click();
    get('aboutModal').querySelector('.about-content').scrollTop = 100;
    get('aboutHelpBtn').click(); get('helpAboutBtn').click();
    expect(get('aboutModal').querySelector('.about-content').scrollTop).toBe(0);
    expect(get('aboutCopyVersion').disabled).toBe(false);
    clipboard.mockRejectedValueOnce(new Error('denied')); get('aboutCopyVersion').click();
    await vi.waitFor(() => expect(get('aboutCopyFallback').hidden).toBe(false));
    resolve(); await Promise.resolve(); await Promise.resolve();
    expect(get('aboutCopyFallback').hidden).toBe(false);
    expect(get('aboutCopyStatus').textContent).toContain('无法自动复制');
  });
});
