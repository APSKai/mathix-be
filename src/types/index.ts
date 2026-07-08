export interface PaginationData<T> {
    items: T[]
    pagination: {
        totalItems: number
        currentPage: number
        totalPages: number
        itemsPerPage: number
    }
}
