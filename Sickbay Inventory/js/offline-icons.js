(function () {
  const iconMap = {
    'hospital': '🏥',
    'menu': '☰',
    'bell': '🔔',
    'search': '🔎',
    'shield-check': '🛡️',
    'log-out': '↩️',
    'layout-dashboard': '📊',
    'package': '📦',
    'users': '👥',
    'clipboard-list': '📝',
    'bar-chart-3': '📈',
    'settings': '⚙️',
    'shield-alert': '🚨',
    'moon': '🌙',
    'sun': '☀️',
    'chevron-down': '▾',
    'plus-circle': '➕',
    'alert-triangle': '⚠️',
    'user-check': '✅',
    'database': '🗄️',
    'clock': '🕒',
    'pill': '💊',
    'check-circle': '✔️',
    'trash-2': '🗑️',
    'x': '✕',
    'message-square': '💬',
    'chevrons-right': '⟶',
    'lock': '🔒',
    'heart': '❤',
    'activity': '⚡',
    'thermometer': '🌡️',
    'syringe': '💉',
    'check-square': '☑️',
    'loader': '⏳',
    'archive': '🗂️',
    'bar-chart-big': '📊',
    'alert-circle': '⚠️',
    'check': '✓',
    'home': '🏠',
    'file-text': '📄'
  };

  function renderIcon(el) {
    if (!el) return;
    const name = (el.getAttribute('data-lucide') || '').trim().toLowerCase();
    el.textContent = iconMap[name] || '•';
    el.setAttribute('aria-hidden', 'true');
  }

  function createIcons() {
    document.querySelectorAll('[data-lucide]').forEach(renderIcon);
  }

  window.lucide = { createIcons };
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', createIcons, { once: true });
  } else {
    createIcons();
  }
})();
