export const ACTION_MENU_OPEN_REQUEST = 'pokegonexus:action-menu-open-request';
export const ACTION_MENU_DID_OPEN = 'pokegonexus:action-menu-did-open';

export const requestActionMenuOpen = () => {
  window.dispatchEvent(new Event(ACTION_MENU_OPEN_REQUEST));
};
