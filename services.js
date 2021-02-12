export const isArray = Array.isArray
export const isObject = value => typeof value === 'object'


export const createApp = Vue 
  ? Vue.createApp
  : () => {}

export const requestGet = axios.get
export const requestPost = axios.post
export const requestPut = axios.put
export const requestDelete = axios.delete

export const render = (...args) = {
  const [el, ...children] 
  
  return Vue.h.call(null, el, ...children)
  
  return args.map(arg => {
      return isArray(arg)
        ? render.apply(null, arg)
        : Vue.h
  })
}