import type { Friend } from './types';

/** TEMPORARY sample friends. */
export const MOCK_FRIENDS: Friend[] = [
  { id: 'f1', name: 'Maya', status: 'accepted', contacts: { instagram: '@maya.goes.out' }, color: '#E8483B' },
  { id: 'f2', name: 'Jordan', status: 'accepted', contacts: { snapchat: 'jordo_b' }, color: '#2A66C9' },
  { id: 'f3', name: 'Sam', status: 'accepted', contacts: { phone: '617-555-0142' }, color: '#1F9D55' },
  { id: 'f4', name: 'Ava', status: 'accepted', contacts: { instagram: '@ava_in_boston' }, color: '#9B3D8A' },
  { id: 'f5', name: 'Noah', status: 'incoming', contacts: {}, color: '#F59A1B' },
];
