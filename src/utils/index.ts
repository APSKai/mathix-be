import { FilterQuery } from 'mongoose'

import { PaginationData } from '@/types'

export const paginateResult = async <T>(
    model: any,
    query: FilterQuery<any>,
    page: number,
    limit: number,
    sort: string | Record<string, any> = { updatedAt: -1 },
    select: string = '',
    populate: any[] = []
): Promise<PaginationData<T>> => {
    const skip = (page - 1) * limit

    const [items, total] = await Promise.all([
        model
            .find(query)
            .select(select)
            .sort(sort)
            .skip(skip)
            .limit(limit)
            .populate(populate)
            .lean(),
        model.countDocuments(query),
    ])

    return {
        items,
        pagination: {
            totalItems: total,
            currentPage: page,
            totalPages: Math.ceil(total / limit),
            itemsPerPage: limit,
        },
    }
}

export const toSlug = (str: string): string => {
    return str
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[đĐ]/g, 'd')
        .replace(/([^0-9a-z-\s])/g, '')
        .replace(/(\s+)/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-+|-+$/g, '')
}

export const isMobileDevice = (ua: string): boolean => {
    return (
        /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile|Macintosh/i.test(
            ua
        ) && ua.length < 200
    )
}
