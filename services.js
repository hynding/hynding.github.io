export const isArray = Array.isArray
export const isObject = value => typeof value === 'object'


export const createApp = Vue.createApp

export const requestGet = axios.get
export const requestPost = axios.post
export const requestPut = axios.put
export const requestDelete = axios.delete

export const render = (...args) = {
  if (args.length && isArray(args[0]))
}