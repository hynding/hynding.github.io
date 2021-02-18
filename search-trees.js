const byObjectKey = (key, desc = true) => (a,b)=>(b[key]-a[key])*(desc?1:-1)

const byObjectKeys = keys => (a,b) => keys.reduce((result, key)=>result||(b[key]-a[key]), 0)



const sort = list => ({
  by: options => list.slice(0).sort(typeof options === 'string'
    ? byObjectKey(options)
    : byObjectKeys(options)
  }
})

const toTree = (tree, ) => []

const createSearchTree = options => {
  const {
    rows,
    cols,
    indices, // sort order array of col indices
  } = options
  
  const sortedRows = sort(rows).by(indices)
  
  Math.ceil(sortedRows.length/2)
  
  
}