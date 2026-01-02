document.addEventListener('DOMContentLoaded', () => {
  const header = `
    <header class="header">
      <img src="logo.png" class="logo" alt="logo">
      <nav>
        <a href="index.html">預約</a>
        <a href="info.html">場地資訊</a>
        <a href="my-bookings.html">我的預約</a>
      </nav>
    </header>
  `;

  const footer = `
    <footer class="footer">
      © 2026 羽球場預約系統
    </footer>
  `;

  document.body.insertAdjacentHTML('afterbegin', header);
  document.body.insertAdjacentHTML('beforeend', footer);
});
