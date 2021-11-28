import toposort from 'toposort'

export class Service {
    deps : string[]
    init : (tree: object) => any
    name: string
    after(deps: string[]|string) : Service {
        if (typeof deps === "string") {
            this.deps.push(deps)
        } else {
            this.deps = [...this.deps, ...deps]
        }
        return this
    }
    with(fn : (tree: object) => any ) : Service {
        this.init = fn
        return this
    }
    constructor(name : string) {
        this.name = name
        this.deps = []
        this.init = () => {throw Error("No init method defined in "+ name)}
    }
    _checkDep(allowed : Set<String>) {
        for (let dep of this.deps) {
            if (! allowed.has(dep)) {
                throw Error(`${this.name} depends on ${dep}, which does not exist`)
            }
        }
    }
    _getEdges() : [string,string][] {
        const edges : [string, string][] = []
        for (let dep of this.deps) edges.push([dep, this.name])
        return edges
    }
}

export class ServiceList {
    services : Service[]
    tree: { [key: string] : any}
    constructor() {
        this.services = []
        this.tree = {}
    }
    add(service : Service) : ServiceList {
        this.services.push(service)
        return this
    }
    async resolve() : Promise<any>{
        // Get set of services defined and make sure no services depend on anything else
        const serviceSet = new Set(this.services.map(x => x.name))
        for (let service of this.services) service._checkDep(serviceSet)
        // Create a list of edges representing dependencies
        let edges : [string,string][] = []
        for (let service of this.services) edges = edges.concat(service._getEdges())
        // Sort them.
        const orderedServices = toposort(edges)
        // Execute them in order
        for (let serviceName of orderedServices) {
            const indx = this.services.findIndex(x => x.name === serviceName)
            const svcFn : any = this.services[indx].init(this.tree)
            if (svcFn instanceof Promise) {
                this.tree[serviceName] = await svcFn
            } else {
                this.tree[serviceName] = svcFn
            }
        }
        return this.tree
    }
}

/*const svcs = new ServiceList().
    add(new Service("secrets").after(["dbg","log"]).with(async () => "Secrets")).
    add(new Service("dbg").with(() => "Debug")).
    add(new Service("log").after("dbg").with(() => "Log"))
svcs.resolve().then(console.log)*/