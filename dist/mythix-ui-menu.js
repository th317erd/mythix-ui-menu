import {
  MythixUIComponent,
  BaseUtils,
  Utils,
  ComponentUtils,
} from '@cdn/mythix-ui-core@1';

const IS_ITEM           = /^li$/i;
const IS_POPOVER        = /^mythix-popover$/i;
const SHOULD_IGNORE_KEY = /^(Alt|AltGraph|CapsLock|Control|Fn|FnLock|Hyper|Meta|NumLock|ScrollLock|Shift|Super|Symbol|SymbolLock|OS)$/;

const ITEM_ELEMENT_TYPE = 'li';
const MENU_ELEMENT_TYPE = 'menu';

const AUTO_OPEN_TIME_DEFAULT = 500;

const WRAP_AROUND = true;

export class MythixUIMenu extends MythixUIComponent {
  static tagName = 'mythix-menu';

  get autoOpenTime() {
    let value = this.attr('auto-open-time');
    if (value == null || value === '')
      return AUTO_OPEN_TIME_DEFAULT;

    return Math.round(parseFloat(value));
  }

  set autoOpenTime(_value) {
    let value = Math.round(parseFloat(_value));
    if (!isFinite(value))
      value = AUTO_OPEN_TIME_DEFAULT;

    this.attr('auto-open-time', value);
  }

  createShadowDOM() {
  }

  generateKeybindingDisplay(encodedKey) {
    if (!encodedKey)
      return '';

    let {
      altKey,
      ctrlKey,
      shiftKey,
      metaKey,
      code,
    } = this.reverseEncodedKeybinding(encodedKey);

    let parts = [
      ctrlKey && 'Ctrl',
      shiftKey && 'Shift',
      altKey && 'Alt',
      metaKey && 'Meta',
      code.replace(/^(Key|Digit)/, ''),
    ].filter(Boolean);

    return parts.join('+');
  }

  findKeybindingEncodingByPath(itemPath) {
    for (let binding of Object.entries(this._keybindings)) {
      let [ key, value ] = binding;
      if (itemPath === value)
        return key;
    }
  }

  mounted() {
    super.mounted();

    let id                  = this.attr('id');
    let currentFocusedItem  = null;
    let keybindings         = (id) ? (Utils.storage.get('localStorage', 'mythix-ui-menu', id, 'keybindings') || {}) : {};

    Object.defineProperties(this, {
      '_currentFocusedItem': {
        enumerable:   false,
        configurable: true,
        get:          () => currentFocusedItem,
        set:          (newValue) => {
          let previousFocusedItem = currentFocusedItem;

          currentFocusedItem = newValue;

          this.onHoveredItemChange(newValue, previousFocusedItem);
        },
      },
      '_keybindings': {
        enumerable:   false,
        configurable: true,
        get:          () => keybindings,
        set:          (newValue) => {
          keybindings = newValue;
        },
      },
    });

    document.addEventListener('click', this.onClick);
    document.addEventListener('keydown', this.onKeyDown, { capture: true });

    this.addEventListener('mouseover', this.onMouseOver);
    this.addEventListener('mouseout', this.onMouseOut);
    this.addEventListener('focusin', this.onFocusIn);
    this.addEventListener('focusout', this.onFocusOut);

    let tabIndexCounter = ComponentUtils.getLargestDocumentTabIndex() + 1;

    this.select(ITEM_ELEMENT_TYPE).forEach(($item) => {
      if (!$item.getAttribute('id'))
        $item.setAttribute('id', BaseUtils.getObjectID($item));

      let tabIndex = $item.getAttribute('tabindex');
      if (tabIndex == null || tabIndex === '')
        $item.setAttribute('tabindex', tabIndexCounter++);

      if (id && !this.isTopLevelItem($item)) {
        let itemPath    = this.getItemPath($item);
        let encodedKey  = this.findKeybindingEncodingByPath(itemPath);
        let $keybinding = $item.querySelector('.mythix-menu-keybinding-callout');
        if (!$keybinding) {
          $keybinding = (this.ownerDocument || document).createElement('span');
          $keybinding.classList.add('mythix-menu-keybinding-callout');
          $item.appendChild($keybinding);
        }

        let keybindingProp = Utils.dynamicPropID(`mythix-ui-menu:${id}:keybindings:${itemPath}`, this.generateKeybindingDisplay(encodedKey));
        $keybinding.innerText = ('' + keybindingProp);

        keybindingProp.addEventListener('update', () => {
          $keybinding.innerText = ('' + keybindingProp);
        });
      }
    });

    this.select(MENU_ELEMENT_TYPE).forEach(($menu) => {
      if (!$menu.getAttribute('id'))
        $menu.setAttribute('id', BaseUtils.getObjectID($menu));

      let $popover = document.createElement('mythix-popover');
      $popover.setAttribute('id', BaseUtils.getObjectID($popover));

      let $item = $menu.closest(ITEM_ELEMENT_TYPE);
      if ($item) {
        $popover.setAttribute('anchor', $item.getAttribute('id') || BaseUtils.getObjectID($item));

        if (this.isTopLevelItem($item))
          $popover.setAttribute('anchor-alignment', '0.0 1.0 0.0 0.0');
        else
          $popover.setAttribute('anchor-alignment', '1.0 0.0 0.0 0.0');

        $item.classList.add('mythix-menu-has-sub-menu');
      }

      $menu.parentNode.replaceChild($popover, $menu);
      $popover.appendChild($menu);
    });
  }

  unmounted() {
    this.removeEventListener('focusout', this.onFocusOut);
    this.removeEventListener('focusin', this.onFocusIn);
    this.removeEventListener('mouseout', this.onMouseOut);
    this.removeEventListener('mouseover', this.onMouseOver);

    document.removeEventListener('keydown', this.onKeyDown);
    document.removeEventListener('click', this.onClick);
  }

  isAnyMenuOpen() {
    return this.select('mythix-popover[open]')[0];
  }

  isExpandableItem($item) {
    return !!this.findChildMenu($item);
  }

  isItemExpanded($item) {
    let childMenu = this.findChildMenu($item);
    if (!childMenu)
      return false;

    return childMenu.open;
  }

  getClickItem(event) {
    return event.target.closest(ITEM_ELEMENT_TYPE);
  }

  isTopLevelItem($item) {
    return (Array.from(this.childNodes).indexOf($item) >= 0);
  }

  findChildMenu($item) {
    if (!$item || !$item.children)
      return;

    return $item.querySelector(':scope > mythix-popover');
  }

  dispatchSelectedEvent($item) {
    let event = new Event('selected');

    event.relatedTarget = $item;
    event.command       = this.getItemPath($item);

    this.dispatchEvent(event);
  }

  updateHasFocusClasses() {
    // Update class list for items
    this.select(`${ITEM_ELEMENT_TYPE}.mythix-menu-has-focus`)
        .forEach(($element) => $element.classList.remove('mythix-menu-has-focus'));

    // Update class based on open popovers
    this.select('mythix-popover[open]')
        .forEach(($popover) => {
          let $item = $popover.closest(ITEM_ELEMENT_TYPE);
          if (!$item)
            return;

          $item.classList.add('mythix-menu-has-focus');
        });
  }

  closeAll(...except) {
    let anyClosed = false;

    const isException = (element) => {
      return except.some((exceptElem) => element && element.contains(exceptElem));
    };

    this.select('mythix-popover[open]').forEach((element) => {
      if (isException(element))
        return;

      anyClosed = true;
      element.hidePopover();
    });

    this.updateHasFocusClasses();

    return anyClosed;
  }

  getItemPath(_$item) {
    let commandAttribute = (_$item && _$item.getAttribute('data-command'));
    if (commandAttribute)
      return commandAttribute;

    let $item = _$item;
    let path        = [];

    while ($item) {
      let value = $item.getAttribute('value');
      if (value)
        path.push(value);

      let parentNode = Utils.getParentNode($item);
      $item = (parentNode) ? parentNode.closest(ITEM_ELEMENT_TYPE) : null;
    }

    return `/${path.reverse().join('/')}`;
  }

  getItemFromPath(path) {
    let parts     = path.split('/');
    let lastPart  = parts[parts.length - 1];

    let $items = this.select(`${ITEM_ELEMENT_TYPE}[value="${lastPart}"]`);
    for (let $item of Array.from($items || [])) {
      let itemPath = this.getItemPath($item);
      if (itemPath === path)
        return $item;
    }
  }

  getParentPopovers($item) {
    let parentNode  = Utils.getParentNode($item);
    let popovers    = [];

    while (parentNode) {
      if (parentNode === this)
        break;

      if (IS_POPOVER.test(parentNode.tagName))
        popovers.push(parentNode);

      parentNode = Utils.getParentNode(parentNode);
    }

    return popovers;
  }

  activateItem($item) {
    if (this.isExpandableItem($item)) {
      this.openToItem($item, true);
    } else {
      this.closeAll();

      $item.focus();

      this.dispatchSelectedEvent($item);
    }
  }

  openToItem($item, force) {
    let $mainPopover    = this.findChildMenu($item);
    let $parentPopovers = this.getParentPopovers($item);

    this.closeAll($mainPopover, ...$parentPopovers);

    let isOpening = false;
    if (force == null)
      isOpening = !(($mainPopover || $parentPopovers[0] || {}).open);
    else if (force === false)
      isOpening = false;
    else if (force)
      isOpening = true;

    $parentPopovers.reverse().forEach(($popoverParent) => {
      $popoverParent.togglePopover(isOpening);
    });

    if ($mainPopover)
      $mainPopover.togglePopover(isOpening);

    this.updateHasFocusClasses();

    return isOpening;
  }

  findPreviousSiblingItem($item, wrapAround) {
    if (!$item)
      return;

    let sibling = $item.previousElementSibling;
    while (sibling) {
      if (IS_ITEM.test(sibling.tagName))
        return sibling;

      sibling = sibling.previousElementSibling;
    }

    if (wrapAround)
      return this.findLastSiblingItem($item);
  }

  findNextSiblingItem($item, wrapAround) {
    if (!$item)
      return;

    let sibling = $item.nextElementSibling;
    while (sibling) {
      if (IS_ITEM.test(sibling.tagName))
        return sibling;

      sibling = sibling.nextElementSibling;
    }

    if (wrapAround)
      return this.findFirstSiblingItem($item);
  }

  findFirstSiblingItem($item) {
    let parentNode = Utils.getParentNode($item);
    if (!parentNode)
      return;

    let firstSibling = parentNode.children[0];
    while (firstSibling) {
      if (firstSibling !== $item && IS_ITEM.test(firstSibling.tagName))
        return firstSibling;

      firstSibling = firstSibling.nextElementSibling;
    }
  }

  findLastSiblingItem($item) {
    let parentNode = Utils.getParentNode($item);
    if (!parentNode)
      return;

    let lastSibling = parentNode.children[parentNode.children.length - 1];
    while (lastSibling) {
      if (lastSibling !== $item && IS_ITEM.test(lastSibling.tagName))
        return lastSibling;

      lastSibling = lastSibling.previousElementSibling;
    }
  }

  findFirstChildItem($item) {
    let $childPopover = this.findChildMenu($item);
    if (!$childPopover)
      return;

    return $childPopover.querySelector(ITEM_ELEMENT_TYPE);
  }

  findParentItem($item) {
    let parentNode = Utils.getParentNode($item);
    if (!parentNode)
      return;

    return parentNode.closest(ITEM_ELEMENT_TYPE);
  }

  findRootParentItem($item) {
    let parentNode    = Utils.getParentNode($item);
    let finalElement  = null;

    while (parentNode) {
      if (parentNode === this)
        break;

      if (IS_ITEM.test(parentNode.tagName))
        finalElement = parentNode;

      parentNode = Utils.getParentNode(parentNode);
    }

    return finalElement;
  }

  getEncodedKeybindingForEvent(event) {
    return [
      event.altKey % 2,
      event.ctrlKey % 2,
      event.shiftKey % 2,
      event.metaKey % 2,
      event.code,
    ].join('');
  }

  reverseEncodedKeybinding(encodedKey) {
    if (!encodedKey)
      return;

    // event.altKey % 2,
    // event.ctrlKey % 2,
    // event.shiftKey % 2,
    // event.metaKey % 2,
    // event.code,

    let altKey    = (encodedKey.charAt(0) === '1');
    let ctrlKey   = (encodedKey.charAt(1) === '1');
    let shiftKey  = (encodedKey.charAt(2) === '1');
    let metaKey   = (encodedKey.charAt(3) === '1');
    let code      = encodedKey.substring(4);

    return {
      altKey,
      ctrlKey,
      shiftKey,
      metaKey,
      code,
    };
  }

  updateItemKeyBinding($item, event) {
    let id = this.attr('id');
    if (!id)
      return;

    let keybindings           = this._keybindings;
    let itemPath              = this.getItemPath($item);
    let encodedKey            = this.getEncodedKeybindingForEvent(event);
    let currentBoundItemPath  = keybindings[encodedKey];
    if (currentBoundItemPath) {
      // Update binding dynamic property, updating anywhere this is used in the DOM
      // Updating existing item binding, to make sure it is cleared first
      Utils.dynamicPropID(`mythix-ui-menu:${id}:keybindings:${currentBoundItemPath}`, '');
    }

    for (let [ key, value ] of Object.entries(keybindings)) {
      if (value === itemPath || key === encodedKey)
        delete keybindings[key];
    }

    keybindings[encodedKey] = itemPath;

    console.log('Saving key binding for: ', itemPath, event);
    Utils.storage.set('localStorage', 'mythix-ui-menu', id, 'keybindings', keybindings);

    // Update binding dynamic property, updating anywhere this is used in the DOM
    Utils.dynamicPropID(`mythix-ui-menu:${id}:keybindings:${itemPath}`, this.generateKeybindingDisplay(encodedKey));
  }

  onHoveredItemChange($item) {
    if (!$item) {
      this.clearDebounce('itemHoverPendingOpen');
      return;
    }

    let autoOpenTime = this.autoOpenTime;
    if (!autoOpenTime)
      return;

    let isTopLevel = this.isTopLevelItem($item);
    this.debounce(() => {
      if (isTopLevel && !this.isAnyMenuOpen())
        return;

      if (this.findChildMenu($item))
        this.openToItem($item, true);
      else
        this.closeAll($item);
    }, (isTopLevel) ? 10 : autoOpenTime, 'itemHoverPendingOpen');
  }

  onMouseOver(event) {
    let $item = event.target.closest(ITEM_ELEMENT_TYPE);
    if (this._currentFocusedItem === $item)
      return;

    this._currentFocusedItem = $item || null;
  }

  onMouseOut(event) {
    let element = (event.relatedTarget) ? event.relatedTarget.closest('mythix-menu') : null;
    if (element !== this)
      this._currentFocusedItem = null;
  }

  onFocusIn(event) {
    let $item = event.target.closest(ITEM_ELEMENT_TYPE);
    if (this._currentFocusedItem === $item)
      return;

    this._currentFocusedItem = $item || null;
  }

  onFocusOut(event) {
    let element = (event.relatedTarget) ? event.relatedTarget.closest('mythix-menu') : null;
    if (element !== this)
      this._currentFocusedItem = null;
  }

  isAllowedKeyBinding(event) {
    if (event.code === 'Tab')
      return false;

    return true;
  }

  onKeyDown(event) {
    if (SHOULD_IGNORE_KEY.test(event.key))
      return;

    let $item = this._currentFocusedItem;
    let handled = false;

    if (!this.isAnyMenuOpen() && !$item) {
      let encodedKey  = this.getEncodedKeybindingForEvent(event);
      let command     = this._keybindings[encodedKey];

      if (!command)
        return;

      let $item = this.getItemFromPath(command);
      if ($item) {
        this.activateItem($item);
        return;
      }
    }

    const focusItem = ($item) => {
      if (!$item)
        return;

      this.openToItem($item, true);

      $item.focus();

      handled = true;
    };

    const toggleItem = ($item, force) => {
      if (!$item)
        return;

      this.openToItem($item, force);
      handled = true;
    };

    if ($item && this.isAllowedKeyBinding(event) && !this.isExpandableItem($item) && $item.matches(':hover') && (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey)) {
      this.updateItemKeyBinding($item, event);
      handled = true;
    } else if (event.code === 'Escape') {
      if (this.closeAll())
        handled = true;
    } else if ($item && (event.code === 'Space' || event.code === 'Enter')) {
      this.activateItem($item);
      handled = true;
    } else if ($item && event.code === 'ArrowRight') {
      if (!this.isTopLevelItem($item)) {
        if (this.isExpandableItem($item)) {
          if (!this.isItemExpanded($item)) {
            toggleItem($item);
          } else {
            let $childItem = this.findFirstChildItem($item);
            focusItem($childItem);
          }
        } else {
          let $rootItem = this.findRootParentItem($item);
          if ($rootItem) {
            let $nextItem = this.findNextSiblingItem($rootItem, WRAP_AROUND);
            if ($nextItem) {
              let $childMenuItem = this.findFirstChildItem($nextItem);
              focusItem($childMenuItem);
            }
          }
        }
      } else {
        let $nextItem = this.findNextSiblingItem($item, WRAP_AROUND);
        focusItem($nextItem);
      }
    } else if ($item && event.code === 'ArrowLeft') {
      if (!this.isTopLevelItem($item)) {
        let $parentItem = this.findParentItem($item);
        if ($parentItem) {
          if (this.isTopLevelItem($parentItem)) {
            let $previousItem = this.findPreviousSiblingItem($parentItem, WRAP_AROUND);
            if ($previousItem) {
              let $childMenuItem = this.findFirstChildItem($previousItem);
              focusItem($childMenuItem);
            }
          } else {
            focusItem($parentItem);
          }
        }
      } else {
        let $previousItem = this.findPreviousSiblingItem($item, WRAP_AROUND);
        focusItem($previousItem);
      }
    } else if ($item && event.code === 'ArrowDown') {
      if (this.isTopLevelItem($item)) {
        if (!this.isItemExpanded($item)) {
          toggleItem($item, true);
        } else {
          let $childItem = this.findFirstChildItem($item);
          focusItem($childItem);
        }
      } else {
        let $nextItem = this.findNextSiblingItem($item);
        focusItem($nextItem);
      }
    } else if ($item && event.code === 'ArrowUp') {
      if (this.isTopLevelItem($item)) {
        if (this.isItemExpanded($item))
          toggleItem($item, false);
      } else {
        let $previousItem = this.findPreviousSiblingItem($item);
        if ($previousItem) {
          focusItem($previousItem);
        } else {
          let $parentItem = this.findParentItem($item);
          if ($parentItem && this.isTopLevelItem($parentItem))
            focusItem($parentItem);
        }
      }
    }

    if (handled) {
      event.stopImmediatePropagation();
      event.preventDefault();
    }
  }

  onClick(event) {
    if (!this.contains(event.target)) {
      this.closeAll();
      return;
    }

    let $item = this.getClickItem(event);
    if (!$item)
      return;

    event.stopPropagation();
    event.preventDefault();

    this.activateItem($item);
  }
}

MythixUIMenu.register();
