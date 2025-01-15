declare module 'pdfmake/build/pdfmake' {
    const content: any;
    export default content;
}

declare module 'pdfmake/build/vfs_fonts' {
    export const pdfMake: {
        vfs: any;
    };
} 