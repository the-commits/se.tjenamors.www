// Welcoming log for browser users
export function initWelcome() {
    console.log(
        '%cTjenamors v1.2.3! %c🇸🇪',
        [
            'background: linear-gradient(135deg, #8A2BE2, #4B0082)',
            'color: white',
            'padding: 8px 16px',
            'border-radius: 4px',
            'font-size: 16px',
            'font-weight: bold',
            'font-family: system-ui, sans-serif',
        ].join(';') + ';',
        'font-size: 16px;'
    );
}
