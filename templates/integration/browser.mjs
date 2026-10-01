// Copyright © 2026 Manolo Remiddi · SPDX-License-Identifier: LicenseRef-Augmentor-MIT-Resale-1.0
// Import through your application's existing browser bundler.
import {mountAugmentor} from '@augmentor/app-sdk/browser';
export function mountAppAgent(container, {onStatus, onNavigate, onSettings} = {}) {
  return mountAugmentor({container, title: 'Augmentor', onStatus, onNavigate, onSettings});
}
