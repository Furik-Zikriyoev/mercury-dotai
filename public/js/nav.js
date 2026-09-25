(function() {
  document.addEventListener('DOMContentLoaded', function() {
    const user   = JSON.parse(localStorage.getItem('user') || '{}');
    const avatar = localStorage.getItem('steam_avatar');

    const navUsername = document.getElementById('nav-username');
    const navAvatar   = document.getElementById('nav-avatar');

    if (navUsername && user.login) {
      navUsername.textContent = user.login;
    }

    if (navAvatar) {
      if (avatar) {
        navAvatar.innerHTML = `<img src="${DotAi.esc(avatar)}" style="width:100%;height:100%;object-fit:cover;border-radius:50%">`;
        navAvatar.style.background = 'none';
        navAvatar.style.overflow   = 'hidden';
        navAvatar.style.padding    = '0';
      } else if (user.login) {
        navAvatar.textContent = user.login.slice(0, 2).toUpperCase();
      }
    }
  });
})();