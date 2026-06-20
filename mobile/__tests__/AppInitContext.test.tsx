/**
 * __tests__/AppInitContext.test.tsx
 *
 * Unit tests for AppInitProvider and useAppInit.
 * Covers the hydration sequence and deep-link queue behaviour (issue #32).
 */
import React from 'react';
import { renderHook, act } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppInitProvider, useAppInit } from '../src/context/AppInitContext';

const wrapper = ({ children }: { children: React.ReactNode }) =>
  React.createElement(AppInitProvider, null, children);

beforeEach(() => {
  (AsyncStorage.clear as jest.Mock)();
  (AsyncStorage.getItem as jest.Mock).mockClear();
  (AsyncStorage.setItem as jest.Mock).mockClear();
});

// ── Hydration ────────────────────────────────────────────────────────────────

test('isHydrated starts false and becomes true after AsyncStorage read', async () => {
  const { result } = renderHook(() => useAppInit(), { wrapper });

  expect(result.current.isHydrated).toBe(false);

  await act(async () => {});

  expect(result.current.isHydrated).toBe(true);
});

test('restores walletPublicKey from AsyncStorage on hydration', async () => {
  await AsyncStorage.setItem('greenpay_stellar_public_key', 'GTEST123');

  const { result } = renderHook(() => useAppInit(), { wrapper });
  await act(async () => {});

  expect(result.current.walletPublicKey).toBe('GTEST123');
});

test('walletPublicKey is null when nothing stored', async () => {
  const { result } = renderHook(() => useAppInit(), { wrapper });
  await act(async () => {});

  expect(result.current.walletPublicKey).toBeNull();
});

// ── Deep-link queue ──────────────────────────────────────────────────────────

test('queueDeepLink holds URL until hydrated, then fires handler', async () => {
  const handler = jest.fn();
  const { result } = renderHook(() => useAppInit(), { wrapper });

  // Queue before hydration completes
  act(() => {
    result.current.queueDeepLink('greenpay://project/1');
    result.current.onDeepLinkReady(handler);
  });

  expect(handler).not.toHaveBeenCalled();

  // Let hydration finish
  await act(async () => {});

  expect(handler).toHaveBeenCalledWith('greenpay://project/1');
  expect(handler).toHaveBeenCalledTimes(1);
});

test('onDeepLinkReady fires immediately if already hydrated', async () => {
  const handler = jest.fn();
  const { result } = renderHook(() => useAppInit(), { wrapper });

  // Hydrate first
  await act(async () => {});
  expect(result.current.isHydrated).toBe(true);

  // Queue a URL after hydration — should call handler right away
  act(() => {
    result.current.onDeepLinkReady(handler);
    result.current.queueDeepLink('greenpay://donate/GABC');
  });

  expect(handler).toHaveBeenCalledWith('greenpay://donate/GABC');
});

test('queued URL is only processed once even if onDeepLinkReady called twice', async () => {
  const handler = jest.fn();
  const { result } = renderHook(() => useAppInit(), { wrapper });

  act(() => {
    result.current.queueDeepLink('greenpay://project/dupe');
    result.current.onDeepLinkReady(handler);
    result.current.onDeepLinkReady(handler); // re-register (should not double-fire)
  });

  await act(async () => {});

  expect(handler).toHaveBeenCalledTimes(1);
});

test('throws when used outside AppInitProvider', () => {
  // Suppress React error boundary noise in test output
  const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
  expect(() => renderHook(() => useAppInit())).toThrow(
    'useAppInit must be used inside <AppInitProvider>',
  );
  spy.mockRestore();
});
