const byObjectKey = (key, desc = true => (a,b)=>(b[key]-a[key])*(desc?1:-1)
const sort = list => ({
  by: options => {
    if (typeof options === 'string') {
      return list.slice(0).sort(byObjectKey(options))
    }
    
    
  }
})

const createSearchTree = options => {
  const {
    rows,
    cols,
  } = options
  
  
}