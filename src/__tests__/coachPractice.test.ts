import AsyncStorage from '@react-native-async-storage/async-storage';
import { isCoachConversation, recordCoachConversation, flushCoachPractice, type CoachPracticeContext } from '../services/coachPractice';
import { getClientOrThrow } from '../services/serviceUtils';

jest.mock('@react-native-async-storage/async-storage', () => ({ __esModule:true, default:{getItem:jest.fn(),setItem:jest.fn()} }));
jest.mock('../services/serviceUtils', () => ({getClientOrThrow:jest.fn()}));
jest.mock('../services/trainingCurriculumService', () => ({getEffectiveLocalDate:()=> '2026-10-12'}));
const rpc=jest.fn();
const storage=new Map<string,string>();
const context:CoachPracticeContext={dogId:'dog',skillId:'skill',roundId:'round',sessionId:'session',question:{
  id:'q',concept:'1-1:1:0',skillCode:'1-1',lessonTitle:'Door',level:1,prompt:'What next?',
  options:[{id:'0',label:'Wait'}],correctOptionId:'0',explanation:'Wait',cueAt:0,
}};
beforeEach(()=>{
  jest.resetAllMocks(); storage.clear();
  jest.mocked(AsyncStorage.getItem).mockImplementation(async key=>storage.get(key)??null);
  jest.mocked(AsyncStorage.setItem).mockImplementation(async(key,value)=>{storage.set(key,value);});
  jest.mocked(getClientOrThrow).mockReturnValue({rpc} as never);
  rpc.mockResolvedValue({data:{},error:null});
});

test('opening, step choice, greeting, empty reply and failed calls do not qualify',()=>{
  const user={id:'u',role:'user' as const,text:'My dog walks away'};
  expect(isCoachConversation([],{state:'ready',text:'Welcome'})).toBe(false);
  expect(isCoachConversation([{...user,fromChoice:true}],{state:'ready',text:'Tell me more'})).toBe(false);
  expect(isCoachConversation([user],{state:'offline'})).toBe(false);
  expect(isCoachConversation([user],{state:'failed',detail:'error'})).toBe(false);
  expect(isCoachConversation([user],{state:'unconfigured'})).toBe(false);
  expect(isCoachConversation([user],{state:'ready',text:'  '})).toBe(false);
  expect(isCoachConversation([user],{state:'ready',text:'Try a shorter wait'})).toBe(true);
  expect(isCoachConversation([{...user,text:'',image:{uri:'local',base64:'private-photo',mimeType:'image/jpeg'}}],{state:'ready',text:'Try a shorter wait'})).toBe(true);
});

test('records only identifiers and caption context after a real reply',async()=>{
  await recordCoachConversation(context);
  expect(rpc).toHaveBeenCalledWith('training_round_action',expect.objectContaining({p_dog_id:'dog',p_action:'coach_reply',p_payload:{roundId:'round',sessionId:'session',question:context.question}}));
  expect(JSON.parse(storage.get('paws:coach-practice:v1:dog')!)).toEqual([]);
});

test('failed network save persists and retries without the chat or attachments',async()=>{
  rpc.mockResolvedValueOnce({error:{message:'offline'}});
  await expect(recordCoachConversation(context)).rejects.toEqual({message:'offline'});
  expect(JSON.parse(storage.get('paws:coach-practice:v1:dog')!)).toEqual([context]);
  await flushCoachPractice('dog');
  expect(rpc).toHaveBeenCalledTimes(2);
  expect(JSON.parse(storage.get('paws:coach-practice:v1:dog')!)).toEqual([]);
});

test('pending entries for another dog are never submitted',async()=>{
  storage.set('paws:coach-practice:v1:other',JSON.stringify([{...context,dogId:'other'}]));
  await flushCoachPractice('dog');
  expect(rpc).not.toHaveBeenCalled();
});

test('duplicate queued conversations remain one pending round/level entry',async()=>{
  rpc.mockResolvedValue({error:{message:'offline'}});
  await Promise.allSettled([recordCoachConversation(context),recordCoachConversation(context)]);
  expect(JSON.parse(storage.get('paws:coach-practice:v1:dog')!)).toHaveLength(1);
});
