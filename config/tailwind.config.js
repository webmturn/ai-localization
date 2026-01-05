/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ['class', '.dark-mode'],
  content: [
    "./public/*.html",
    "./public/**/*.html",
    "./public/*.js",
    "./public/**/*.js"
  ],
  safelist: [
    'text-white',
    'bg-white',
    'text-gray-700',
    'text-gray-500',
    'border-gray-300',
    'hover:bg-gray-50',
    'bg-blue-50',
    'text-primary',
    'bg-primary',
    'hover:bg-primary/90',
    'focus:ring-2',
    'focus:ring-offset-2',
    'ring-1',
    'ring-2',
    'ring-offset-2',
    'bg-primary-dark',
    'hover:bg-primary-dark',
    'border-primary',
    'bg-red-50',
    'bg-red-100',
    'bg-red-600',
    'hover:bg-red-100',
    'hover:bg-red-700',
    'border-red-200',
    'text-red-600',
    'text-red-700',
    { pattern: /^(bg|text|border|ring)-(red|gray|blue|green|yellow|amber)-(50|100|200|300|400|500|600|700|800|900)$/ },
    { pattern: /^(bg|text|border|ring)-primary(\/(5|10|20|30|40|50|60|70|80|90|95))?$/ },
    {
      pattern: /^(bg|text|border|ring)-(red|gray|blue|green|yellow|amber)-(50|100|200|300|400|500|600|700|800|900)$/,
      variants: ['hover', 'focus', 'active', 'disabled']
    },
    {
      pattern: /^(bg|text|border|ring)-primary(\/(5|10|20|30|40|50|60|70|80|90|95))?$/,
      variants: ['hover', 'focus', 'active', 'disabled']
    },
    { pattern: /^shadow-dark-elevated$/, variants: ['dark'] }
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


