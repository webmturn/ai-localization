/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ['class', '.dark-mode'],
  content: [
    "./public/*.html",
    "./public/**/*.html",
    "./public/*.js",
    "./public/**/*.js"
  ],
  // safelist: 仅保留 Tailwind content 扫描器无法从 HTML/JS 字面量中提取的类。
  // 所有以完整字符串出现在 public/**/*.{html,js} 中的类会被 JIT 自动收集，
  // 无需重复 safelist。之前的宽泛正则（~1400+ 类）已移除以大幅缩减 CSS 体积。
  safelist: [
    // custom color "primary" 的 opacity 变体（JS 中通过 bg-primary/90 等使用）
    { pattern: /^(bg|text|border|ring)-primary(\/(5|10|20|30|40|50|60|70|80|90|95))?$/ },
    // custom shadow 的 dark 变体
    { pattern: /^shadow-dark-elevated$/, variants: ['dark'] },
  ],
  theme: {
    extend: {
      colors: {
        primary: '#2563eb',
        secondary: '#4b5563',
        accent: '#0ea5e9',
        success: '#10b981',
        warning: '#f59e0b',
        danger: '#ef4444',
        light: '#f3f4f6',
        dark: '#1f2937'
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        'inner-lg': 'inset 0 2px 4px 0 rgba(0, 0, 0, 0.06)',
        'dark-elevated': '0 4px 6px -1px rgba(0, 0, 0, 0.3), 0 2px 4px -1px rgba(0, 0, 0, 0.2), 0 0 0 1px rgba(75, 85, 99, 0.3)',
      }
    }
  },
  plugins: [],
}


