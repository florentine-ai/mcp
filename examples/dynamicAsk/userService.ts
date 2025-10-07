import { TAskInput } from '../../src/lib/types.js';

const userIdForSession: { [key: string]: string } = {
  abc: '66d4a8f3c9e1b2a3d4e5f601',
  def: '507f1f77bcf86cd799439011'
};

// Do a real world fetch here to get user specific data
const fetchUserData = async ({
  sessionId
}: {
  sessionId?: string;
}): Promise<Omit<TAskInput, 'question'>> => {
  if (!sessionId || !userIdForSession[sessionId]) return {};
  return {
    requiredInputs: [{ keyPath: 'userId', value: userIdForSession[sessionId] }]
  };
};

export { fetchUserData };
